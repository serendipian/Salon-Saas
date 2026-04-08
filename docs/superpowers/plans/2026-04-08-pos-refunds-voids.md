# POS Refunds & Voids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add void (same-day cancellation) and refund (partial/full return) capabilities to the POS module while preserving the immutable transaction audit trail.

**Architecture:** Same-table approach — VOID and REFUND are new transaction types with negative totals linked to the original via `original_transaction_id`. Two new SECURITY DEFINER RPCs handle the atomic operations. Existing revenue aggregations auto-adjust via negative amounts.

**Tech Stack:** Supabase (PostgreSQL RPCs, RLS, migrations), React 19, TypeScript, TanStack Query, Tailwind CSS, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-04-08-pos-refunds-voids-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260408210000_pos_refunds_voids.sql` | Schema changes + RPCs + RLS updates + client_stats fix |
| `modules/pos/constants.ts` | Void/refund reason categories |
| `modules/pos/components/VoidModal.tsx` | Void confirmation modal |
| `modules/pos/components/RefundModal.tsx` | Two-step refund modal |
| `modules/accounting/components/RefundsPage.tsx` | Refund/void activity log + KPI charts |

### Modified files
| File | Changes |
|------|---------|
| `types.ts` | Add `type`, `originalTransactionId`, `reasonCategory`, `reasonNote` to Transaction; `originalItemId` to CartItem |
| `modules/pos/mappers.ts` | Add new fields to TransactionRow/TransactionItemRow and toTransaction mapper |
| `hooks/useTransactions.ts` | Add `voidTransaction` and `refundTransaction` mutations |
| `hooks/usePermissions.ts` | Add `void` and `refund` actions to POS resource for owner/manager |
| `lib/auth.types.ts` | Add `'void'` and `'refund'` to AuthAction type |
| `modules/pos/components/POSCatalog.tsx` | Add void/refund action buttons, visual treatment for voided/refunded transactions |
| `modules/pos/components/POSModals.tsx` | Add type badge, reason display, action buttons to TransactionDetailModal |
| `modules/pos/POSModule.tsx` | Wire void/refund modals and pass new callbacks |
| `modules/dashboard/DashboardModule.tsx` | Filter transaction count/avgBasket to SALE only |
| `modules/accounting/hooks/useAccounting.ts` | Filter transaction count/avgBasket to SALE only |
| `modules/accounting/FinancesLayout.tsx` | Add "Annulations" tab title/subtitle |
| `modules/accounting/components/FinancesOverview.tsx` | Add void/refund summary cards |
| `App.tsx` | Add `/finances/annulations` route |

---

## Task 1: Database Migration — Schema + RPCs

**Files:**
- Create: `supabase/migrations/20260408210000_pos_refunds_voids.sql`

- [ ] **Step 1: Create the migration file with schema changes**

```sql
-- ============================================================
-- POS Refunds & Voids: schema, RPCs, RLS, view update
-- ============================================================

-- 1. Add columns to transactions
ALTER TABLE transactions
  ADD COLUMN type TEXT NOT NULL DEFAULT 'SALE'
    CHECK (type IN ('SALE', 'VOID', 'REFUND')),
  ADD COLUMN original_transaction_id UUID REFERENCES transactions(id),
  ADD COLUMN reason_category TEXT,
  ADD COLUMN reason_note TEXT;

-- One void per transaction
CREATE UNIQUE INDEX idx_transactions_void_unique
  ON transactions(original_transaction_id) WHERE type = 'VOID';

-- Fast lookup of refunds/voids for an original
CREATE INDEX idx_transactions_original_id
  ON transactions(original_transaction_id) WHERE original_transaction_id IS NOT NULL;

-- 2. Add original_item_id to transaction_items
ALTER TABLE transaction_items
  ADD COLUMN original_item_id UUID REFERENCES transaction_items(id);

-- 3. Update RLS INSERT policy (defense in depth)
DROP POLICY transactions_insert ON transactions;
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (
  salon_id = get_active_salon()
  AND (type = 'SALE' OR get_user_role() IN ('owner', 'manager'))
);

-- 4. Update client_stats view
DROP VIEW IF EXISTS client_stats;
CREATE VIEW client_stats AS
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

-- 5. void_transaction RPC
CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_reason_category TEXT,
  p_reason_note TEXT
)
RETURNS UUID AS $$
DECLARE
  v_original RECORD;
  v_void_id UUID;
  v_item RECORD;
BEGIN
  -- Permission: owner or manager only
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only owner or manager can void transactions'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch and validate original
  SELECT * INTO v_original FROM transactions
  WHERE id = p_transaction_id AND salon_id = p_salon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = '23503';
  END IF;

  IF v_original.type != 'SALE' THEN
    RAISE EXCEPTION 'Only SALE transactions can be voided';
  END IF;

  IF v_original.date::date != CURRENT_DATE THEN
    RAISE EXCEPTION 'Void is only allowed on same-day transactions. Use refund for past transactions.';
  END IF;

  -- Check not already voided
  IF EXISTS (SELECT 1 FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'VOID') THEN
    RAISE EXCEPTION 'Transaction has already been voided';
  END IF;

  -- Check not already refunded (partial or full)
  IF EXISTS (SELECT 1 FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'REFUND') THEN
    RAISE EXCEPTION 'Transaction has refunds — cannot void. Use refund instead.';
  END IF;

  -- Create void transaction (negative total)
  INSERT INTO transactions (
    salon_id, client_id, date, total, notes, created_by, appointment_id,
    type, original_transaction_id, reason_category, reason_note
  ) VALUES (
    p_salon_id, v_original.client_id, now(), -v_original.total, v_original.notes, auth.uid(), NULL,
    'VOID', p_transaction_id, p_reason_category, p_reason_note
  ) RETURNING id INTO v_void_id;

  -- Mirror items with negative prices
  FOR v_item IN
    SELECT * FROM transaction_items WHERE transaction_id = p_transaction_id
  LOOP
    INSERT INTO transaction_items (
      transaction_id, salon_id, reference_id, type, name, variant_name,
      price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
    ) VALUES (
      v_void_id, p_salon_id, v_item.reference_id, v_item.type, v_item.name, v_item.variant_name,
      -v_item.price, v_item.original_price, v_item.quantity, v_item.cost, v_item.note,
      v_item.staff_id, v_item.staff_name, v_item.id
    );

    -- Restock products
    IF v_item.type = 'PRODUCT' AND v_item.reference_id IS NOT NULL THEN
      UPDATE products SET stock = stock + v_item.quantity, updated_at = now()
      WHERE id = v_item.reference_id AND salon_id = p_salon_id;
    END IF;
  END LOOP;

  -- Mirror payments with negative amounts
  INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
  SELECT v_void_id, p_salon_id, method, -amount
  FROM transaction_payments WHERE transaction_id = p_transaction_id;

  RETURN v_void_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. refund_transaction RPC
CREATE OR REPLACE FUNCTION refund_transaction(
  p_transaction_id UUID,
  p_salon_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_reason_category TEXT,
  p_reason_note TEXT,
  p_restock BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
  v_original RECORD;
  v_refund_id UUID;
  v_item JSONB;
  v_orig_item RECORD;
  v_already_refunded INTEGER;
  v_refund_total NUMERIC(10,2) := 0;
  v_payment JSONB;
  v_payment_total NUMERIC(10,2) := 0;
  v_total_previously_refunded NUMERIC(10,2);
  v_item_price NUMERIC(10,2);
BEGIN
  -- Permission: owner or manager only
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only owner or manager can refund transactions'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch and validate original
  SELECT * INTO v_original FROM transactions
  WHERE id = p_transaction_id AND salon_id = p_salon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = '23503';
  END IF;

  IF v_original.type != 'SALE' THEN
    RAISE EXCEPTION 'Only SALE transactions can be refunded';
  END IF;

  -- Check not voided
  IF EXISTS (SELECT 1 FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'VOID') THEN
    RAISE EXCEPTION 'Transaction has been voided — cannot refund';
  END IF;

  -- Calculate total previously refunded
  SELECT COALESCE(SUM(ABS(total)), 0) INTO v_total_previously_refunded
  FROM transactions WHERE original_transaction_id = p_transaction_id AND type = 'REFUND';

  -- Create refund transaction (total computed from items)
  INSERT INTO transactions (
    salon_id, client_id, date, total, notes, created_by,
    type, original_transaction_id, reason_category, reason_note
  ) VALUES (
    p_salon_id, v_original.client_id, now(), 0, NULL, auth.uid(),
    'REFUND', p_transaction_id, p_reason_category, p_reason_note
  ) RETURNING id INTO v_refund_id;

  -- Process refund items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'original_item_id') IS NOT NULL THEN
      -- Linked item: validate against original
      SELECT * INTO v_orig_item FROM transaction_items
      WHERE id = (v_item->>'original_item_id')::uuid AND transaction_id = p_transaction_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Refund item references invalid original item';
      END IF;

      -- Check already-refunded quantity for this item
      SELECT COALESCE(SUM(ti.quantity), 0) INTO v_already_refunded
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE ti.original_item_id = v_orig_item.id AND t.type = 'REFUND';

      IF (v_item->>'quantity')::integer > (v_orig_item.quantity - v_already_refunded) THEN
        RAISE EXCEPTION 'Refund quantity exceeds remaining quantity for item %', v_orig_item.name;
      END IF;

      -- Use price_override if provided, otherwise use original price
      IF (v_item->>'price_override') IS NOT NULL THEN
        v_item_price := (v_item->>'price_override')::numeric;
        IF v_item_price > v_orig_item.price * (v_item->>'quantity')::integer THEN
          RAISE EXCEPTION 'Price override exceeds original item total for %', v_orig_item.name;
        END IF;
        -- For price_override: store as single negative amount
        INSERT INTO transaction_items (
          transaction_id, salon_id, reference_id, type, name, variant_name,
          price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
        ) VALUES (
          v_refund_id, p_salon_id, v_orig_item.reference_id, v_orig_item.type,
          v_orig_item.name, v_orig_item.variant_name,
          -v_item_price, v_orig_item.original_price, 1, v_orig_item.cost, v_orig_item.note,
          v_orig_item.staff_id, v_orig_item.staff_name, v_orig_item.id
        );
        v_refund_total := v_refund_total + v_item_price;
      ELSE
        -- Standard: mirror item with negative price, requested quantity
        INSERT INTO transaction_items (
          transaction_id, salon_id, reference_id, type, name, variant_name,
          price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
        ) VALUES (
          v_refund_id, p_salon_id, v_orig_item.reference_id, v_orig_item.type,
          v_orig_item.name, v_orig_item.variant_name,
          -v_orig_item.price, v_orig_item.original_price, (v_item->>'quantity')::integer,
          v_orig_item.cost, v_orig_item.note,
          v_orig_item.staff_id, v_orig_item.staff_name, v_orig_item.id
        );
        v_refund_total := v_refund_total + (v_orig_item.price * (v_item->>'quantity')::integer);
      END IF;

      -- Restock product if requested
      IF p_restock AND v_orig_item.type = 'PRODUCT' AND v_orig_item.reference_id IS NOT NULL THEN
        UPDATE products SET stock = stock + (v_item->>'quantity')::integer, updated_at = now()
        WHERE id = v_orig_item.reference_id AND salon_id = p_salon_id;
      END IF;

    ELSE
      -- Manual amount item (no original_item_id)
      INSERT INTO transaction_items (
        transaction_id, salon_id, reference_id, type, name, variant_name,
        price, original_price, quantity, cost, note, staff_id, staff_name, original_item_id
      ) VALUES (
        v_refund_id, p_salon_id, NULL, 'SERVICE',
        COALESCE(v_item->>'name', 'Remboursement partiel'), NULL,
        -(v_item->>'price')::numeric, NULL, 1, NULL, NULL, NULL, NULL, NULL
      );
      v_refund_total := v_refund_total + (v_item->>'price')::numeric;
    END IF;
  END LOOP;

  -- Over-refund guard
  IF (v_total_previously_refunded + v_refund_total) > v_original.total THEN
    RAISE EXCEPTION 'Total refunded amount (%) would exceed original transaction total (%)',
      v_total_previously_refunded + v_refund_total, v_original.total;
  END IF;

  -- Update the refund transaction total (negative)
  UPDATE transactions SET total = -v_refund_total WHERE id = v_refund_id;

  -- Validate payments
  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0) INTO v_payment_total
  FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total != v_refund_total THEN
    RAISE EXCEPTION 'Refund payment total (%) does not match refund total (%)', v_payment_total, v_refund_total;
  END IF;

  -- Insert refund payments (negative amounts)
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_refund_id, p_salon_id, v_payment->>'method', -(v_payment->>'amount')::numeric);
  END LOOP;

  RETURN v_refund_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Apply migration to remote database**

Run: `npx supabase db push --linked`

Expected: Migration applied successfully.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts`

Expected: `lib/database.types.ts` updated with new columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260408210000_pos_refunds_voids.sql lib/database.types.ts
git commit -m "feat(db): add void/refund schema, RPCs, RLS, and client_stats update"
```

---

## Task 2: TypeScript Types + Constants + Mappers

**Files:**
- Modify: `types.ts:337-368`
- Modify: `modules/pos/mappers.ts:6-90`
- Modify: `lib/auth.types.ts:62`
- Create: `modules/pos/constants.ts`

- [ ] **Step 1: Update Transaction and CartItem types in `types.ts`**

Add to `CartItem` interface (after `staffName` at line 349):

```typescript
  originalItemId?: string;
```

Add to `Transaction` interface (after `payments` at line 367):

```typescript
  type: 'SALE' | 'VOID' | 'REFUND';
  originalTransactionId?: string;
  reasonCategory?: string;
  reasonNote?: string;
```

- [ ] **Step 2: Add `'void'` and `'refund'` to AuthAction type in `lib/auth.types.ts`**

Change line 62 from:

```typescript
export type AuthAction = 'view' | 'create' | 'edit' | 'delete' | 'manage';
```

To:

```typescript
export type AuthAction = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'void' | 'refund';
```

- [ ] **Step 3: Create `modules/pos/constants.ts`**

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

export type VoidCategoryKey = typeof VOID_CATEGORIES[number]['key'];
export type RefundCategoryKey = typeof REFUND_CATEGORIES[number]['key'];
```

- [ ] **Step 4: Update `TransactionRow` and `TransactionItemRow` in `modules/pos/mappers.ts`**

Add to `TransactionItemRow` (after `staff_name` at line 18):

```typescript
  original_item_id: string | null;
```

Add to `TransactionRow` (after `created_by` at line 36):

```typescript
  type: string;
  original_transaction_id: string | null;
  reason_category: string | null;
  reason_note: string | null;
```

- [ ] **Step 5: Update `toTransaction` mapper in `modules/pos/mappers.ts`**

In the items mapping (around line 49-62), add `originalItemId`:

```typescript
    originalItemId: item.original_item_id ?? undefined,
```

In the return object (around line 80-89), add the new fields:

```typescript
    type: (row.type as 'SALE' | 'VOID' | 'REFUND') ?? 'SALE',
    originalTransactionId: row.original_transaction_id ?? undefined,
    reasonCategory: row.reason_category ?? undefined,
    reasonNote: row.reason_note ?? undefined,
```

- [ ] **Step 6: Commit**

```bash
git add types.ts lib/auth.types.ts modules/pos/constants.ts modules/pos/mappers.ts
git commit -m "feat(pos): add refund/void types, constants, and mapper updates"
```

---

## Task 3: Permissions + Transaction Hook Mutations

**Files:**
- Modify: `hooks/usePermissions.ts:12-73`
- Modify: `hooks/useTransactions.ts:1-85`

- [ ] **Step 1: Add void/refund actions to owner and manager POS permissions**

In `hooks/usePermissions.ts`, update the POS line for `owner` (line 17):

```typescript
    pos:          { actions: ['view', 'create', 'void', 'refund'], level: 'full' },
```

Update the POS line for `manager` (line 32):

```typescript
    pos:          { actions: ['view', 'create', 'void', 'refund'], level: 'full' },
```

Stylist (line 47) and receptionist (line 62) remain unchanged: `['view', 'create']`.

- [ ] **Step 2: Add `voidTransaction` mutation to `hooks/useTransactions.ts`**

Add after the `addTransactionMutation` (after line 75):

```typescript
  const voidMutation = useMutation({
    mutationFn: async ({
      transactionId,
      reasonCategory,
      reasonNote,
    }: {
      transactionId: string;
      reasonCategory: string;
      reasonNote: string;
    }) => {
      const { error } = await supabase.rpc('void_transaction', {
        p_transaction_id: transactionId,
        p_salon_id: salonId,
        p_reason_category: reasonCategory,
        p_reason_note: reasonNote,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: toastOnError("Impossible d'annuler la transaction"),
  });
```

- [ ] **Step 3: Add `refundTransaction` mutation to `hooks/useTransactions.ts`**

Add after the `voidMutation`:

```typescript
  const refundMutation = useMutation({
    mutationFn: async ({
      transactionId,
      items,
      payments,
      reasonCategory,
      reasonNote,
      restock,
    }: {
      transactionId: string;
      items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[];
      payments: { method: string; amount: number }[];
      reasonCategory: string;
      reasonNote: string;
      restock: boolean;
    }) => {
      const { error } = await supabase.rpc('refund_transaction', {
        p_transaction_id: transactionId,
        p_salon_id: salonId,
        p_items: items,
        p_payments: payments,
        p_reason_category: reasonCategory,
        p_reason_note: reasonNote,
        p_restock: restock,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: toastOnError('Impossible de rembourser la transaction'),
  });
```

- [ ] **Step 4: Export the new functions from the hook return**

Update the return object (around line 80-84):

```typescript
  const voidTransaction = (transactionId: string, reasonCategory: string, reasonNote: string) =>
    voidMutation.mutateAsync({ transactionId, reasonCategory, reasonNote });

  const refundTransaction = (
    transactionId: string,
    items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[],
    payments: { method: string; amount: number }[],
    reasonCategory: string,
    reasonNote: string,
    restock: boolean
  ) => refundMutation.mutateAsync({ transactionId, items, payments, reasonCategory, reasonNote, restock });

  return {
    transactions,
    isLoading,
    addTransaction,
    voidTransaction,
    refundTransaction,
    isVoiding: voidMutation.isPending,
    isRefunding: refundMutation.isPending,
  };
```

- [ ] **Step 5: Commit**

```bash
git add hooks/usePermissions.ts hooks/useTransactions.ts
git commit -m "feat(pos): add void/refund permissions and transaction mutations"
```

---

## Task 4: Transaction Status Helper

**Files:**
- Modify: `modules/pos/mappers.ts` (add helper function at end of file)

- [ ] **Step 1: Add `getTransactionStatus` helper to `modules/pos/mappers.ts`**

Add at the end of the file:

```typescript
// --- Transaction status helpers ---

export type TransactionStatus = 'active' | 'voided' | 'partially_refunded' | 'fully_refunded';

export function getTransactionStatus(
  transaction: Transaction,
  allTransactions: Transaction[]
): TransactionStatus {
  if (transaction.type !== 'SALE') return 'active'; // only compute for SALEs

  const relatedVoid = allTransactions.find(
    t => t.type === 'VOID' && t.originalTransactionId === transaction.id
  );
  if (relatedVoid) return 'voided';

  const refunds = allTransactions.filter(
    t => t.type === 'REFUND' && t.originalTransactionId === transaction.id
  );
  if (refunds.length === 0) return 'active';

  const totalRefunded = refunds.reduce((sum, r) => sum + Math.abs(r.total), 0);
  // Allow small floating point tolerance
  if (totalRefunded >= transaction.total - 0.01) return 'fully_refunded';
  return 'partially_refunded';
}

export function getRefundedAmount(
  transactionId: string,
  allTransactions: Transaction[]
): number {
  return allTransactions
    .filter(t => t.type === 'REFUND' && t.originalTransactionId === transactionId)
    .reduce((sum, r) => sum + Math.abs(r.total), 0);
}
```

Add the import at the top of `mappers.ts` (line 2):

```typescript
import { CartItem, PaymentEntry, Transaction } from '../../types';
```

(This import already exists — no change needed.)

- [ ] **Step 2: Commit**

```bash
git add modules/pos/mappers.ts
git commit -m "feat(pos): add transaction status helper functions"
```

---

## Task 5: VoidModal Component

**Files:**
- Create: `modules/pos/components/VoidModal.tsx`

- [ ] **Step 1: Create VoidModal component**

```typescript
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Transaction } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { VOID_CATEGORIES } from '../constants';

interface VoidModalProps {
  transaction: Transaction;
  onConfirm: (reasonCategory: string, reasonNote: string) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}

export const VoidModal: React.FC<VoidModalProps> = ({ transaction, onConfirm, onClose, isPending }) => {
  const { isMobile } = useMediaQuery();
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const canSubmit = category.length > 0 && note.trim().length > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onConfirm(category, note.trim());
  };

  const content = (
    <div className="space-y-5">
      {/* Warning */}
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">
          <p className="font-semibold">Annulation définitive</p>
          <p className="mt-1">Cette action va créer une écriture d'annulation. La transaction originale restera visible dans l'historique.</p>
        </div>
      </div>

      {/* Transaction summary */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Client</span>
          <span className="font-medium text-slate-900">{transaction.clientName || 'Client de passage'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Articles</span>
          <span className="text-slate-700">{transaction.items.length} article{transaction.items.length > 1 ? 's' : ''}</span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span className="text-slate-700">Total</span>
          <span className="text-slate-900">{formatPrice(transaction.total)}</span>
        </div>
      </div>

      {/* Reason category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif *</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[44px]"
        >
          <option value="">Sélectionner un motif...</option>
          {VOID_CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Commentaire *</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Décrivez la raison de l'annulation..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        {isPending ? 'Annulation en cours...' : "Confirmer l'annulation"}
      </button>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Annuler la transaction"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">Annuler la transaction</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          {content}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">Annuler la transaction</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="p-6">{content}</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/pos/components/VoidModal.tsx
git commit -m "feat(pos): add VoidModal component"
```

---

## Task 6: RefundModal Component

**Files:**
- Create: `modules/pos/components/RefundModal.tsx`

- [ ] **Step 1: Create RefundModal component**

```typescript
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, RotateCcw, Package } from 'lucide-react';
import { Transaction, CartItem } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { REFUND_CATEGORIES } from '../constants';
import { getRefundedAmount } from '../mappers';

interface RefundItem {
  originalItemId: string;
  item: CartItem;
  maxQuantity: number; // original quantity minus already refunded
  selectedQuantity: number;
  selected: boolean;
}

interface RefundModalProps {
  transaction: Transaction;
  allTransactions: Transaction[];
  onConfirm: (
    items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[],
    payments: { method: string; amount: number }[],
    reasonCategory: string,
    reasonNote: string,
    restock: boolean
  ) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'CARD', label: 'Carte Bancaire' },
  { value: 'TRANSFER', label: 'Virement' },
  { value: 'CHECK', label: 'Chèque' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'OTHER', label: 'Autre' },
];

export const RefundModal: React.FC<RefundModalProps> = ({
  transaction, allTransactions, onConfirm, onClose, isPending,
}) => {
  const { isMobile } = useMediaQuery();
  const [step, setStep] = useState<1 | 2>(1);
  const [manualMode, setManualMode] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [restock, setRestock] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  // Calculate already-refunded quantities per item
  const refundItems = useMemo<RefundItem[]>(() => {
    const refundTransactions = allTransactions.filter(
      t => t.type === 'REFUND' && t.originalTransactionId === transaction.id
    );

    return transaction.items.map(item => {
      const alreadyRefunded = refundTransactions.reduce((sum, rt) => {
        const matchingItems = rt.items.filter(ri => ri.originalItemId === item.id);
        return sum + matchingItems.reduce((s, ri) => s + ri.quantity, 0);
      }, 0);

      return {
        originalItemId: item.id,
        item,
        maxQuantity: item.quantity - alreadyRefunded,
        selectedQuantity: 0,
        selected: false,
      };
    });
  }, [transaction, allTransactions]);

  const [items, setItems] = useState(refundItems);

  const totalAlreadyRefunded = getRefundedAmount(transaction.id, allTransactions);
  const maxRefundable = transaction.total - totalAlreadyRefunded;

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const selected = !it.selected;
      return { ...it, selected, selectedQuantity: selected ? it.maxQuantity : 0 };
    }));
  };

  const setQuantity = (idx: number, qty: number) => {
    setItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, selectedQuantity: Math.min(Math.max(0, qty), it.maxQuantity), selected: qty > 0 } : it
    ));
  };

  const selectedTotal = manualMode
    ? Math.min(parseFloat(manualAmount) || 0, maxRefundable)
    : items.reduce((sum, it) => it.selected ? sum + (it.item.price * it.selectedQuantity) : sum, 0);

  const hasProducts = items.some(it => it.selected && it.item.type === 'PRODUCT');
  const canProceed = manualMode ? (selectedTotal > 0 && selectedTotal <= maxRefundable) : selectedTotal > 0;
  const canSubmit = canProceed && category.length > 0 && note.trim().length > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    let refundItemsPayload: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[];

    if (manualMode) {
      refundItemsPayload = [{ original_item_id: null, quantity: 1, price: selectedTotal, name: 'Remboursement partiel' }];
    } else {
      refundItemsPayload = items
        .filter(it => it.selected && it.selectedQuantity > 0)
        .map(it => ({ original_item_id: it.originalItemId, quantity: it.selectedQuantity }));
    }

    const payments = [{ method: paymentMethod, amount: selectedTotal }];
    await onConfirm(refundItemsPayload, payments, category, note.trim(), restock);
  };

  // Original payment method(s) for display
  const originalPayments = transaction.payments.map(p => p.method).join(', ');

  const step1Content = (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setManualMode(false)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${!manualMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Par article
        </button>
        <button
          onClick={() => setManualMode(true)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${manualMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Montant personnalisé
        </button>
      </div>

      {totalAlreadyRefunded > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Déjà remboursé : {formatPrice(totalAlreadyRefunded)} / {formatPrice(transaction.total)} — Restant : {formatPrice(maxRefundable)}
        </div>
      )}

      {manualMode ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant à rembourser *</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max={maxRefundable}
              value={manualAmount}
              onChange={e => setManualAmount(e.target.value)}
              placeholder={`Max ${formatPrice(maxRefundable)}`}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px]"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((ri, idx) => (
            <div
              key={ri.originalItemId}
              className={`border rounded-lg p-3 transition-colors ${ri.maxQuantity === 0 ? 'bg-slate-50 opacity-50' : ri.selected ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={ri.selected}
                  onChange={() => toggleItem(idx)}
                  disabled={ri.maxQuantity === 0}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm text-slate-900">{ri.item.name}</div>
                      {ri.item.variantName && <div className="text-xs text-slate-500">{ri.item.variantName}</div>}
                      {ri.item.staffName && <div className="text-xs text-blue-600 mt-0.5">{ri.item.staffName}</div>}
                    </div>
                    <span className="font-semibold text-sm text-slate-900 ml-2">
                      {formatPrice(ri.item.price * ri.selectedQuantity)}
                    </span>
                  </div>
                  {ri.maxQuantity === 0 ? (
                    <div className="text-xs text-slate-400 mt-1">Entièrement remboursé</div>
                  ) : ri.item.quantity > 1 ? (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-500">Qté :</span>
                      <button
                        onClick={() => setQuantity(idx, ri.selectedQuantity - 1)}
                        className="w-7 h-7 rounded border border-slate-300 flex items-center justify-center text-sm hover:bg-slate-100"
                      >−</button>
                      <span className="text-sm font-medium w-6 text-center">{ri.selectedQuantity}</span>
                      <button
                        onClick={() => setQuantity(idx, ri.selectedQuantity + 1)}
                        className="w-7 h-7 rounded border border-slate-300 flex items-center justify-center text-sm hover:bg-slate-100"
                      >+</button>
                      <span className="text-xs text-slate-400">/ {ri.maxQuantity}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restock toggle — only when products are selected */}
      {hasProducts && !manualMode && (
        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={restock}
            onChange={e => setRestock(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          />
          <div>
            <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <Package size={14} /> Remettre en stock
            </div>
            <div className="text-xs text-slate-500">Les produits seront ajoutés à l'inventaire</div>
          </div>
        </label>
      )}

      {/* Refund total */}
      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
        <span className="font-medium text-slate-700 text-sm">Total remboursement</span>
        <span className="font-bold text-lg text-orange-600">{formatPrice(selectedTotal)}</span>
      </div>

      <button
        onClick={() => setStep(2)}
        disabled={!canProceed}
        className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        Suivant
      </button>
    </div>
  );

  const step2Content = (
    <div className="space-y-5">
      <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> Retour
      </button>

      {/* Refund summary */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-medium text-orange-800 text-sm">Montant à rembourser</span>
          <span className="font-bold text-lg text-orange-700">{formatPrice(selectedTotal)}</span>
        </div>
      </div>

      {/* Original payment for reference */}
      <div className="text-xs text-slate-500">
        Paiement original : <span className="font-medium">{originalPayments}</span>
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode de remboursement *</label>
        <select
          value={paymentMethod}
          onChange={e => setPaymentMethod(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px]"
        >
          {PAYMENT_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Reason category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif *</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px]"
        >
          <option value="">Sélectionner un motif...</option>
          {REFUND_CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Commentaire *</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Décrivez la raison du remboursement..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        {isPending ? 'Remboursement en cours...' : 'Confirmer le remboursement'}
      </button>
    </div>
  );

  const modalContent = step === 1 ? step1Content : step2Content;
  const title = step === 1 ? 'Rembourser — Articles' : 'Rembourser — Paiement';

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          {modalContent}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{modalContent}</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/pos/components/RefundModal.tsx
git commit -m "feat(pos): add RefundModal two-step component"
```

---

## Task 7: Wire Modals into POSModule + Update POSCatalog

**Files:**
- Modify: `modules/pos/POSModule.tsx`
- Modify: `modules/pos/components/POSCatalog.tsx:10-311`
- Modify: `modules/pos/components/POSModals.tsx:448-642`

- [ ] **Step 1: Add void/refund state and callbacks to POSModule.tsx**

Add imports at the top:

```typescript
import { VoidModal } from './components/VoidModal';
import { RefundModal } from './components/RefundModal';
import { getTransactionStatus } from './mappers';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
```

In the component body, add state and destructure new hook returns:

```typescript
const { role } = useAuth();
const { can } = usePermissions(role);
const canVoid = can('void', 'pos');
const canRefund = can('refund', 'pos');

const [voidTransaction, setVoidTransaction] = useState<Transaction | null>(null);
const [refundTransaction, setRefundTransaction] = useState<Transaction | null>(null);
```

Update the useTransactions destructuring to include new functions:

```typescript
const { transactions, isLoading, addTransaction, voidTransaction: doVoid, refundTransaction: doRefund, isVoiding, isRefunding } = useTransactions(/* ... */);
```

Add handler functions:

```typescript
const handleVoidConfirm = async (reasonCategory: string, reasonNote: string) => {
  if (!voidTransaction) return;
  await doVoid(voidTransaction.id, reasonCategory, reasonNote);
  setVoidTransaction(null);
  setDetailTransaction(null);
  addToast({ type: 'success', message: 'Transaction annulée' });
};

const handleRefundConfirm = async (
  items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[],
  payments: { method: string; amount: number }[],
  reasonCategory: string,
  reasonNote: string,
  restock: boolean
) => {
  if (!refundTransaction) return;
  await doRefund(refundTransaction.id, items, payments, reasonCategory, reasonNote, restock);
  setRefundTransaction(null);
  setDetailTransaction(null);
  addToast({ type: 'success', message: 'Remboursement effectué' });
};
```

Add the modals in the JSX return (alongside existing modals):

```tsx
{voidTransaction && (
  <VoidModal
    transaction={voidTransaction}
    onConfirm={handleVoidConfirm}
    onClose={() => setVoidTransaction(null)}
    isPending={isVoiding}
  />
)}

{refundTransaction && (
  <RefundModal
    transaction={refundTransaction}
    allTransactions={transactions}
    onConfirm={handleRefundConfirm}
    onClose={() => setRefundTransaction(null)}
    isPending={isRefunding}
  />
)}
```

Pass new callbacks to POSCatalog:

```tsx
<POSCatalog
  /* ...existing props... */
  onVoidClick={canVoid ? setVoidTransaction : undefined}
  onRefundClick={canRefund ? setRefundTransaction : undefined}
  allTransactions={transactions}
/>
```

Pass to TransactionDetailModal:

```tsx
{detailTransaction && (
  <TransactionDetailModal
    transaction={detailTransaction}
    allTransactions={transactions}
    onClose={() => setDetailTransaction(null)}
    onVoidClick={canVoid ? (t) => { setDetailTransaction(null); setVoidTransaction(t); } : undefined}
    onRefundClick={canRefund ? (t) => { setDetailTransaction(null); setRefundTransaction(t); } : undefined}
  />
)}
```

- [ ] **Step 2: Update POSCatalog props and transaction row rendering**

Add to `POSCatalogProps` interface (around line 10-28):

```typescript
  onVoidClick?: (t: Transaction) => void;
  onRefundClick?: (t: Transaction) => void;
  allTransactions: Transaction[];
```

Import helpers at top:

```typescript
import { getTransactionStatus, TransactionStatus } from '../mappers';
import { MoreVertical, Ban, RotateCcw } from 'lucide-react';
```

Add a status badge helper inside the component:

```typescript
const statusBadge = (status: TransactionStatus, trx: Transaction) => {
  if (trx.type === 'VOID') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Annulation</span>;
  if (trx.type === 'REFUND') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Remboursement</span>;
  if (status === 'voided') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Annulé</span>;
  if (status === 'fully_refunded') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Remboursé</span>;
  if (status === 'partially_refunded') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Remb. partiel</span>;
  return null;
};
```

Update both mobile card and desktop table row renders to:
1. Show the status badge next to the client name
2. Apply `line-through opacity-60` styling for voided transactions
3. Show negative amounts in red for VOID/REFUND entries
4. Add a three-dot action menu on SALE rows with "Annuler" and "Rembourser" options (only when `onVoidClick`/`onRefundClick` are provided)

For the desktop table, add an actions column with a context menu. For mobile cards, add action buttons in the footer alongside the receipt button.

The void button should only be visible when: `trx.type === 'SALE' && status === 'active' && new Date(trx.date).toDateString() === new Date().toDateString()`.

The refund button should only be visible when: `trx.type === 'SALE' && status !== 'voided' && status !== 'fully_refunded'`.

- [ ] **Step 3: Update TransactionDetailModal in POSModals.tsx**

Update the props interface (line 448-451):

```typescript
export const TransactionDetailModal: React.FC<{
  transaction: Transaction;
  allTransactions: Transaction[];
  onClose: () => void;
  onVoidClick?: (t: Transaction) => void;
  onRefundClick?: (t: Transaction) => void;
}>
```

Add at the start of the component:

```typescript
import { getTransactionStatus } from '../mappers';
import { Ban, RotateCcw } from 'lucide-react';

// Inside component:
const status = getTransactionStatus(transaction, allTransactions);
const isToday = new Date(transaction.date).toDateString() === new Date().toDateString();
const showVoid = onVoidClick && transaction.type === 'SALE' && status === 'active' && isToday;
const showRefund = onRefundClick && transaction.type === 'SALE' && status !== 'voided' && status !== 'fully_refunded';
```

Add a type badge in the header section (inside `bg-slate-50 rounded-lg p-4` div, after the transaction ID row):

```tsx
{transaction.type !== 'SALE' && (
  <div className="flex justify-between text-sm">
    <span className="text-slate-500">Type</span>
    <span className={`font-medium ${transaction.type === 'VOID' ? 'text-red-600' : 'text-orange-600'}`}>
      {transaction.type === 'VOID' ? 'Annulation' : 'Remboursement'}
    </span>
  </div>
)}
{transaction.reasonCategory && (
  <div className="flex justify-between text-sm">
    <span className="text-slate-500">Motif</span>
    <span className="font-medium text-slate-700">{transaction.reasonCategory}</span>
  </div>
)}
{transaction.reasonNote && (
  <div className="text-sm mt-2 p-2 bg-white rounded border border-slate-100 text-slate-600 italic">
    {transaction.reasonNote}
  </div>
)}
```

Add action buttons at the bottom of `detailContent` (after the summary div):

```tsx
{(showVoid || showRefund) && (
  <div className="flex gap-2 pt-2">
    {showVoid && (
      <button
        onClick={() => onVoidClick!(transaction)}
        className="flex-1 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
      >
        <Ban size={16} /> Annuler
      </button>
    )}
    {showRefund && (
      <button
        onClick={() => onRefundClick!(transaction)}
        className="flex-1 py-2.5 rounded-lg text-sm font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
      >
        <RotateCcw size={16} /> Rembourser
      </button>
    )}
  </div>
)}
```

- [ ] **Step 4: Add watermark to ReceiptModal for voided/refunded transactions**

In `POSModals.tsx`, the `ReceiptModal` component also needs `allTransactions` and `getTransactionStatus` to determine if a watermark should be shown. Update its props to accept `allTransactions: Transaction[]`, then add a watermark overlay inside the receipt content:

```tsx
// At the top of ReceiptModal's render, compute status:
const status = getTransactionStatus(transaction, allTransactions);
const watermark = status === 'voided' ? 'ANNULÉ' : status === 'fully_refunded' ? 'REMBOURSÉ' : null;
```

Inside the receipt content wrapper, add a positioned watermark when applicable:

```tsx
{watermark && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <span className="text-5xl font-black text-red-200 -rotate-12 select-none opacity-60">
      {watermark}
    </span>
  </div>
)}
```

Ensure the receipt container has `relative` positioning so the watermark overlays correctly. Also pass `allTransactions` from POSModule where ReceiptModal is rendered.

- [ ] **Step 5: Verify the app compiles**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add modules/pos/POSModule.tsx modules/pos/components/POSCatalog.tsx modules/pos/components/POSModals.tsx
git commit -m "feat(pos): wire void/refund modals and update transaction display"
```

---

## Task 8: Dashboard + Accounting KPI Fixes

**Files:**
- Modify: `modules/dashboard/DashboardModule.tsx:132-175`
- Modify: `modules/accounting/hooks/useAccounting.ts:167-212`

- [ ] **Step 1: Filter dashboard transaction count and avg basket to SALE only**

In `modules/dashboard/DashboardModule.tsx`, update the stats computation (around lines 132-137):

Change:

```typescript
const revenue = data.current.transactions.reduce((sum, t) => sum + t.total, 0);
const avgBasket = data.current.transactions.length > 0 ? revenue / data.current.transactions.length : 0;
```

To:

```typescript
const revenue = data.current.transactions.reduce((sum, t) => sum + t.total, 0);
const saleCount = data.current.transactions.filter(t => t.type === 'SALE').length;
const avgBasket = saleCount > 0 ? revenue / saleCount : 0;
```

Do the same for the previous period:

```typescript
const prevRevenue = data.previous.transactions.reduce((sum, t) => sum + t.total, 0);
const prevSaleCount = data.previous.transactions.filter(t => t.type === 'SALE').length;
const prevAvgBasket = prevSaleCount > 0 ? prevRevenue / prevSaleCount : 0;
```

- [ ] **Step 2: Filter accounting transaction count and avg basket to SALE only**

In `modules/accounting/hooks/useAccounting.ts`, update the financials computation (around lines 167-184):

Change:

```typescript
const avgBasket = data.current.transactions.length > 0 ? revenue / data.current.transactions.length : 0;
```

To:

```typescript
const saleCount = data.current.transactions.filter(t => t.type === 'SALE').length;
const avgBasket = saleCount > 0 ? revenue / saleCount : 0;
```

And for previous period:

```typescript
const prevSaleCount = data.previous.transactions.filter(t => t.type === 'SALE').length;
const prevAvgBasket = prevSaleCount > 0 ? prevRevenue / prevSaleCount : 0;
```

Also update the `transactionCount` return value:

```typescript
transactionCount: saleCount,
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/dashboard/DashboardModule.tsx modules/accounting/hooks/useAccounting.ts
git commit -m "fix(kpi): filter transaction count and avg basket to SALE type only"
```

---

## Task 9: Accounting — Refund Activity Log Page

**Files:**
- Create: `modules/accounting/components/RefundsPage.tsx`
- Modify: `modules/accounting/FinancesLayout.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create RefundsPage component**

```typescript
import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Ban, RotateCcw } from 'lucide-react';
import { formatPrice } from '../../../lib/format';
import { VOID_CATEGORIES, REFUND_CATEGORIES } from '../../pos/constants';
import type { FinancesOutletContext } from '../FinancesLayout';
import type { Transaction } from '../../../types';

const CHART_COLORS = ['#0f172a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const getCategoryLabel = (key: string): string => {
  const void_ = VOID_CATEGORIES.find(c => c.key === key);
  if (void_) return void_.label;
  const refund_ = REFUND_CATEGORIES.find(c => c.key === key);
  if (refund_) return refund_.label;
  return key;
};

export const RefundsPage: React.FC = () => {
  const { transactions } = useOutletContext<FinancesOutletContext>();

  const { voids, refunds, stats, categoryData } = useMemo(() => {
    const voids = transactions.filter((t: Transaction) => t.type === 'VOID');
    const refunds = transactions.filter((t: Transaction) => t.type === 'REFUND');

    const totalVoided = voids.reduce((s: number, t: Transaction) => s + Math.abs(t.total), 0);
    const totalRefunded = refunds.reduce((s: number, t: Transaction) => s + Math.abs(t.total), 0);

    // Category breakdown across both voids and refunds
    const catMap = new Map<string, number>();
    [...voids, ...refunds].forEach((t: Transaction) => {
      if (t.reasonCategory) {
        catMap.set(t.reasonCategory, (catMap.get(t.reasonCategory) || 0) + Math.abs(t.total));
      }
    });
    const categoryData = Array.from(catMap.entries())
      .map(([key, value]) => ({ name: getCategoryLabel(key), value }))
      .sort((a, b) => b.value - a.value);

    return {
      voids,
      refunds,
      stats: { totalVoided, totalRefunded, voidCount: voids.length, refundCount: refunds.length },
      categoryData,
    };
  }, [transactions]);

  const allEntries = [...voids, ...refunds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Annulations</div>
          <div className="text-2xl font-bold text-red-600">{stats.voidCount}</div>
          <div className="text-sm text-slate-500 mt-1">{formatPrice(stats.totalVoided)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Remboursements</div>
          <div className="text-2xl font-bold text-orange-600">{stats.refundCount}</div>
          <div className="text-sm text-slate-500 mt-1">{formatPrice(stats.totalRefunded)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Total perdu</div>
          <div className="text-2xl font-bold text-slate-900">{formatPrice(stats.totalVoided + stats.totalRefunded)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Taux d'annulation</div>
          <div className="text-2xl font-bold text-slate-900">
            {transactions.filter((t: Transaction) => t.type === 'SALE').length > 0
              ? ((stats.voidCount + stats.refundCount) / transactions.filter((t: Transaction) => t.type === 'SALE').length * 100).toFixed(1)
              : '0'}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category pie chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Motifs</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatPrice(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {categoryData.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-slate-600">{c.name}</span>
                    </div>
                    <span className="font-medium text-slate-900">{formatPrice(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400 text-center py-8">Aucune donnée</div>
          )}
        </div>

        {/* Activity log */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Historique</h3>
          </div>
          {allEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <RotateCcw size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucune annulation ou remboursement sur cette période.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {allEntries.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-full ${entry.type === 'VOID' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                    {entry.type === 'VOID' ? <Ban size={14} /> : <RotateCcw size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entry.type === 'VOID' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {entry.type === 'VOID' ? 'Annulation' : 'Remboursement'}
                        </span>
                        <span className="text-sm text-slate-700 ml-2">{entry.clientName || 'Client de passage'}</span>
                      </div>
                      <span className="font-bold text-sm text-red-600">{formatPrice(Math.abs(entry.total))}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 space-x-3">
                      <span>{new Date(entry.date).toLocaleString()}</span>
                      {entry.reasonCategory && <span>· {getCategoryLabel(entry.reasonCategory)}</span>}
                    </div>
                    {entry.reasonNote && (
                      <div className="mt-1 text-xs text-slate-400 italic truncate">{entry.reasonNote}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Update FinancesLayout.tsx to handle the new route**

In `modules/accounting/FinancesLayout.tsx`, add after the journal line (line 17):

```typescript
else if (path.includes('/annulations')) { pageTitle = 'Annulations & Remboursements'; pageSubtitle = 'Suivi des annulations et remboursements'; }
```

- [ ] **Step 3: Add route in App.tsx**

Add import:

```typescript
import { RefundsPage } from './modules/accounting/components/RefundsPage';
```

Add route inside the finances Route group (after the journal route, around line 163):

```tsx
<Route path="annulations" element={<RefundsPage />} />
```

- [ ] **Step 4: Add navigation link to the Finances sub-nav**

Check where the finances sub-navigation tabs are rendered (likely in FinancesOverview or FinancesLayout) and add an "Annulations" tab linking to `/finances/annulations`. This follows the existing pattern of tab links (Vue d'ensemble, Revenus, Dépenses, Journal).

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add modules/accounting/components/RefundsPage.tsx modules/accounting/FinancesLayout.tsx App.tsx
git commit -m "feat(accounting): add refund/void activity log page with KPI charts"
```

---

## Task 10: End-to-End Manual Testing

- [ ] **Step 1: Test void flow**
1. Log in as owner/manager
2. Create a sale transaction (service + product)
3. In the History tab, verify the "Annuler" action appears on the transaction
4. Click "Annuler", fill in category + note, confirm
5. Verify: void entry appears as sub-row, original shows "Annulé" badge, product stock restored
6. Verify: void action no longer appears on the voided transaction

- [ ] **Step 2: Test refund flow (line-item)**
1. Create a new sale transaction with 2 services and 1 product (qty 2)
2. Click "Rembourser", select one service and 1 qty of the product
3. Choose payment method, fill category + note
4. Confirm refund
5. Verify: refund entry appears, "Remb. partiel" badge on original, product stock incremented by 1
6. Click "Rembourser" again on same transaction — verify remaining quantities are correct

- [ ] **Step 3: Test refund flow (manual amount)**
1. On a sale transaction, click "Rembourser"
2. Switch to "Montant personnalisé"
3. Enter a custom amount less than the total
4. Complete the flow
5. Verify: refund recorded with "Remboursement partiel" label

- [ ] **Step 4: Test edge cases**
1. Verify void not available after midnight (create sale, wait or test with DB date)
2. Verify receptionist/stylist cannot see void/refund actions
3. Verify over-refund is blocked (try refunding more than remaining)
4. Verify voided transaction cannot be refunded

- [ ] **Step 5: Test dashboard and accounting impact**
1. Check dashboard revenue KPI — should reflect net revenue (sales minus refunds/voids)
2. Check average basket — should count SALE transactions only
3. Check accounting Finances page — revenue, COGS, net profit should reflect refunds
4. Navigate to Finances > Annulations — verify activity log and pie chart

- [ ] **Step 6: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix(pos): address issues found during refund/void manual testing"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Database migration (schema + RPCs + RLS + view) | None |
| 2 | TypeScript types + constants + mappers | Task 1 (types regenerated) |
| 3 | Permissions + transaction hook mutations | Task 2 |
| 4 | Transaction status helper | Task 2 |
| 5 | VoidModal component | Task 2 |
| 6 | RefundModal component | Task 4 |
| 7 | Wire modals into POS module + update display | Tasks 3, 4, 5, 6 |
| 8 | Dashboard + accounting KPI fixes | Task 2 |
| 9 | Accounting refund activity log page | Task 2 |
| 10 | End-to-end manual testing | Tasks 7, 8, 9 |

Tasks 3, 4, 5, 6 can run in parallel after Task 2. Tasks 8 and 9 can run in parallel with Tasks 5-7.
