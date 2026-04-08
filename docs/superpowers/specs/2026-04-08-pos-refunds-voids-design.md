# POS Refunds & Voids — Design Spec

## Overview

Add void and refund capabilities to the Caisse (POS) module while preserving the immutable transaction audit trail. Voids cancel same-day transactions; refunds handle partial or full returns on past transactions. Both create new reversal entries linked to the original — no existing records are modified.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who can void/refund | Owner + manager only | Separation of duties; prevents cashier fraud |
| Architecture | Same table, new `type` column | `SUM(total)` auto-adjusts across dashboard/accounting |
| Void time window | Calendar day (midnight cutoff) | Simple, no close-out workflow needed |
| Refund granularity | Line-item selection + manual amount override | Clean audit trail by default, flexibility for edge cases |
| Refund payment method | Manager chooses freely, original displayed for reference | Practical for markets where card refund processing is slow |
| Product restock | Default on, toggle to skip | Covers both return-to-shelf and goodwill-gesture scenarios |
| Reason tracking | Required category dropdown + required free-text note | Category enables KPI analytics; note provides context |
| Receptionist access | No | Manager override is the control, not a notification |

## 1. Database Schema Changes

### 1.1 Alter `transactions` table

```sql
ALTER TABLE transactions
  ADD COLUMN type TEXT NOT NULL DEFAULT 'SALE'
    CHECK (type IN ('SALE', 'VOID', 'REFUND')),
  ADD COLUMN original_transaction_id UUID REFERENCES transactions(id),
  ADD COLUMN reason_category TEXT,
  ADD COLUMN reason_note TEXT;

-- One void per transaction
CREATE UNIQUE INDEX idx_transactions_void_unique
  ON transactions(original_transaction_id) WHERE type = 'VOID';

-- Fast lookup of refunds/voids for an original transaction
CREATE INDEX idx_transactions_original_id
  ON transactions(original_transaction_id) WHERE original_transaction_id IS NOT NULL;
```

`DEFAULT 'SALE'` auto-backfills all existing rows — no data migration needed.

### 1.2 Alter `transaction_items` table

```sql
ALTER TABLE transaction_items
  ADD COLUMN original_item_id UUID REFERENCES transaction_items(id);
```

Links refund/void items to the exact original item. Enables per-item over-refund protection and precise staff commission adjustment.

### 1.3 Update RLS INSERT policy (defense in depth)

```sql
DROP POLICY transactions_insert ON transactions;
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (
  salon_id = get_active_salon()
  AND (type = 'SALE' OR get_user_role() IN ('owner', 'manager'))
);
```

RPCs are SECURITY DEFINER (bypass RLS), but this prevents direct table inserts of VOID/REFUND by non-managers.

### 1.4 Update `client_stats` view

```sql
CREATE OR REPLACE VIEW client_stats AS
SELECT
  c.id AS client_id,
  c.salon_id,
  COUNT(DISTINCT t.id) FILTER (WHERE t.type = 'SALE') AS total_visits,
  COALESCE(SUM(t.total), 0) AS total_spent,
  MIN(t.date) FILTER (WHERE t.type = 'SALE')::date AS first_visit_date,
  MAX(t.date) FILTER (WHERE t.type = 'SALE')::date AS last_visit_date
FROM clients c
LEFT JOIN transactions t ON t.client_id = c.id AND t.salon_id = c.salon_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.salon_id;
```

- `total_visits`: counts only SALE transactions (voids/refunds are not visits)
- `total_spent`: sums all types (negative refund totals auto-subtract — correct net spend)
- `first_visit_date` / `last_visit_date`: based on SALE transactions only

## 2. RPC Functions

Both functions are SECURITY DEFINER with internal permission checks, following the `create_transaction` pattern.

### 2.1 `void_transaction`

```
void_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_reason_category TEXT,
  p_reason_note TEXT
) RETURNS UUID
```

**Steps:**
1. Permission check — caller must be owner or manager
2. Validate original — must exist, must be `type = 'SALE'`, must belong to `p_salon_id`
3. Same-day check — `original.date::date = CURRENT_DATE`; reject if not
4. Not already voided — no existing VOID for this transaction
5. Not already refunded — no existing REFUND records (prevents voiding a partially refunded transaction; use refund instead)
6. Insert reversal transaction — `type = 'VOID'`, `total = -original.total`, `original_transaction_id` set, `created_by = auth.uid()`
7. Mirror all items — copy with negative prices, positive quantities, `original_item_id` set
8. Mirror all payments — copy with negative amounts
9. Restock products — for PRODUCT items, increment stock by quantity
10. Return new void transaction ID

### 2.2 `refund_transaction`

```
refund_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_reason_category TEXT,
  p_reason_note TEXT,
  p_restock BOOLEAN DEFAULT TRUE
) RETURNS UUID
```

**`p_items` format:**
```json
[
  { "original_item_id": "uuid", "quantity": 1 },
  { "original_item_id": "uuid", "quantity": 2, "price_override": 15.00 },
  { "original_item_id": null, "quantity": 1, "price": 25.00, "name": "Remboursement partiel" }
]
```

- Items with `original_item_id`: linked to a specific original item, price derived from original
- Items with `price_override`: custom refund amount for that item (must be <= original item total)
- Items with `null original_item_id`: manual amount override (synthetic item, not linked)

**`p_payments` format:**
```json
[{ "method": "CASH", "amount": 25.00 }]
```

**Steps:**
1. Permission check — owner or manager
2. Validate original — must exist, must be `type = 'SALE'`, not voided
3. Per-item validation:
   - `original_item_id` (when set) must belong to the original transaction
   - Quantity <= (original quantity - already refunded quantity for that item)
   - `price_override` (when set) must be <= original item price * quantity
4. Over-refund guard — sum of all refunds (existing + this one) must not exceed original total
5. Payment validation — sum of `p_payments` amounts must equal the refund total
6. Insert refund transaction — `type = 'REFUND'`, negative total, `original_transaction_id` set
7. Insert refund items — negative prices, positive quantities, `original_item_id` set (or NULL for manual)
8. Insert refund payments — negative amounts, method as specified
9. Conditional restock — if `p_restock = true`, increment stock for PRODUCT items
10. Return new refund transaction ID

## 3. Frontend — Types & Constants

### 3.1 Type updates (`types.ts`)

Add to `Transaction`:
```typescript
type: 'SALE' | 'VOID' | 'REFUND';
originalTransactionId?: string;
reasonCategory?: string;
reasonNote?: string;
```

Add to `CartItem`:
```typescript
originalItemId?: string;
```

### 3.2 Reason categories (new constants)

```typescript
export const VOID_CATEGORIES = [
  { key: 'entry_mistake', label: 'Erreur de saisie' },
  { key: 'client_cancelled', label: 'Client annulé' },
  { key: 'duplicate', label: 'Doublon' },
  { key: 'other', label: 'Autre' },
] as const;

export const REFUND_CATEGORIES = [
  { key: 'service_quality', label: 'Insatisfaction service' },
  { key: 'defective_product', label: 'Produit défectueux' },
  { key: 'product_return', label: 'Produit retourné' },
  { key: 'billing_error', label: 'Erreur de facturation' },
  { key: 'goodwill', label: 'Geste commercial' },
  { key: 'other', label: 'Autre' },
] as const;
```

English `key` stored in DB (`reason_category` column); French `label` displayed in UI. Enables future i18n.

### 3.3 Mapper updates (`modules/pos/mappers.ts`)

- `TransactionRow` adds: `type`, `original_transaction_id`, `reason_category`, `reason_note`
- `TransactionItemRow` adds: `original_item_id`
- `toTransaction()` maps new fields through

### 3.4 Permission updates (`hooks/usePermissions.ts`)

Add to permission matrix:
```typescript
canVoidTransaction: ['owner', 'manager'],
canRefundTransaction: ['owner', 'manager'],
```

## 4. Frontend — Hook Changes

### 4.1 `hooks/useTransactions.ts`

Add two mutations alongside existing `addTransaction`:

**`voidTransaction`:**
- Calls `void_transaction` RPC
- Params: `transactionId`, `reasonCategory`, `reasonNote`
- Invalidates: `transactions`, `products` (stock)
- Toast on success: "Transaction annulée"

**`refundTransaction`:**
- Calls `refund_transaction` RPC
- Params: `transactionId`, `items`, `payments`, `reasonCategory`, `reasonNote`, `restock`
- Invalidates: `transactions`, `products` (stock)
- Toast on success: "Remboursement effectué"

### 4.2 Helper: `useTransactionStatus`

Utility hook or function to compute the status of a SALE transaction:

```typescript
function getTransactionStatus(transaction: Transaction, allTransactions: Transaction[]) {
  // Returns: 'active' | 'voided' | 'partially_refunded' | 'fully_refunded'
}
```

Computed by checking if any VOID or REFUND transactions reference the original. Used by UI to show badges and control action button visibility.

## 5. Frontend — UI Components

### 5.1 Transaction History List (modified)

**Visual treatment by type:**
- **SALE (active)**: unchanged
- **SALE (voided)**: strikethrough text, muted opacity, red "Annulé" badge
- **SALE (partially refunded)**: orange "Remb. partiel" badge with refunded amount
- **SALE (fully refunded)**: orange "Remboursé" badge
- **VOID entry**: grouped as sub-row under original, red muted style, negative amount
- **REFUND entry**: grouped as sub-row under original, orange style, negative amount

**Grouping:** Transactions with `originalTransactionId` render as indented sub-rows beneath their parent. Parent transactions show an expand/collapse chevron when they have children.

**Action menu (three-dot) on SALE transactions — owner/manager only:**
- "Annuler" — visible if: same day AND not voided AND no refunds exist
- "Rembourser" — visible if: not voided AND not fully refunded

### 5.2 Void Modal (new component)

Simple confirmation modal:
- Transaction summary (date, client, items, total)
- Reason category dropdown (required) — uses `VOID_CATEGORIES`
- Reason note textarea (required)
- "Confirmer l'annulation" button (red)
- Mobile: fullscreen bottom-sheet (follows existing `TransactionDetailModal` pattern)

### 5.3 Refund Modal (new component, two-step)

**Step 1 — Item selection:**
- List of original items with checkboxes
- Already-refunded quantities shown greyed out (e.g., "2/3 déjà remboursés")
- Quantity selector for multi-quantity items (capped at remaining refundable)
- Staff name displayed per item for context
- "Remettre en stock" toggle (default on) — shown only when PRODUCT items are selected
- Running refund total at bottom
- "Montant personnalisé" toggle — switches to a free-form amount input (replaces item list)
- "Suivant" button to proceed

**Step 2 — Payment & reason:**
- Original payment method(s) displayed for reference (read-only)
- Payment method dropdown for the refund (manager's choice)
- Amount pre-filled from step 1
- Reason category dropdown (required) — uses `REFUND_CATEGORIES`
- Reason note textarea (required)
- Refund total summary
- "Confirmer le remboursement" button (orange)

Mobile: fullscreen two-screen flow (follows `AppointmentBuilderMobile` pattern).

### 5.4 Transaction Detail Updates (existing components)

**`TransactionDetailModal`:**
- Show type badge (Annulé / Remboursé / Remb. partiel) in header
- Display reason category + note for VOID/REFUND entries
- "Voir l'original" link on void/refund entries (navigates to parent transaction)
- "Annuler" / "Rembourser" action buttons in footer for eligible SALE transactions (owner/manager only)

**`ReceiptModal`:**
- "ANNULÉ" watermark overlay on voided transactions
- "REMBOURSÉ" watermark on fully refunded transactions

### 5.5 Accounting — Refund Activity Log (new section)

New tab in the accounting module: **"Annulations & Remboursements"**

- Date range filter (reuses `DateRangePicker`)
- Filterable list of VOID and REFUND transactions
- Columns: date, original transaction ref, type badge, amount, category, note, performed by (created_by), affected staff
- **Category breakdown chart** (pie chart via Recharts) — reason category distribution for the selected period
- **Summary cards**: total voided amount, total refunded amount, void count, refund count

This is the owner's oversight dashboard — no notifications needed.

## 6. Impact on Existing Features

### Dashboard
- **Revenue KPI**: auto-adjusted (negative totals subtract from `SUM`)
- **Average basket**: filter to SALE only for count denominator (one line change)
- **Transaction count KPI**: filter to SALE only (one line change)
- **Staff revenue**: auto-adjusted (refund items have negative prices with same `staff_id`)

### Accounting
- **Revenue, COGS, net profit**: auto-adjusted via negative totals/prices
- **Revenue by category/staff**: auto-adjusted via negative item prices
- **Payment method breakdown**: auto-adjusted via negative payment amounts

### Staff Commissions
- Commission = `staff_revenue * rate`. Staff revenue auto-decreases when refund items subtract. No retroactive payout adjustment — next period naturally reflects lower revenue. Manual adjustment by manager if needed.

### Product Stock
- Handled in RPCs: void always restocks; refund restocks if `p_restock = true`
- `useProducts` query invalidated on void/refund mutation

### Appointments
- Voiding a transaction does NOT reopen the linked appointment. The appointment completion is a scheduling fact. Rebooking creates a new appointment.

### Realtime Sync
- `useRealtimeSync('transactions')` watches INSERT events. Void/refund inserts trigger cache invalidation for all connected clients. No changes needed.

### Audit Logging
- Existing `audit_trigger` on `transactions` table captures all INSERTs. Void/refund entries are logged with `performed_by` (auth.uid()). No changes needed.

## 7. Reason Categories (KPI Reference)

### Void categories
| Key | French label |
|-----|-------------|
| `entry_mistake` | Erreur de saisie |
| `client_cancelled` | Client annulé |
| `duplicate` | Doublon |
| `other` | Autre |

### Refund categories
| Key | French label |
|-----|-------------|
| `service_quality` | Insatisfaction service |
| `defective_product` | Produit défectueux |
| `product_return` | Produit retourné |
| `billing_error` | Erreur de facturation |
| `goodwill` | Geste commercial |
| `other` | Autre |

Store the English key in the database; display the French label in the UI. This keeps data consistent and enables future i18n.

## 8. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Void after midnight | Rejected — must use refund instead |
| Refund more than original | Rejected — RPC validates cumulative refunds <= original total |
| Void a voided transaction | Rejected — VOID can only target SALE type |
| Refund a voided transaction | Rejected — RPC checks no VOID exists |
| Void a partially refunded transaction | Rejected — must complete refund process instead |
| Multiple partial refunds | Allowed — each creates a new REFUND transaction, cumulative total tracked |
| Refund with manual amount > original total | Rejected — RPC validates |
| Manual amount refund + line-item refund on same transaction | Allowed — both are REFUND entries, cumulative guard applies |
| Product refund with restock=false | Stock unchanged, refund still recorded |
| Void transaction linked to appointment | Appointment stays COMPLETED, not reopened |
