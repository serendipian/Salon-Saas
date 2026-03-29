# Phase 2: Staff Tracking on POS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-item staff attribution to POS cart items, persist staff_id to transaction_items, and unlock "Par équipe" revenue views in the Finances module.

**Architecture:** Add `staff_id` column to `transaction_items` table (nullable). Extend `CartItem` type with `staffId`/`staffName`. Add a compact staff selector dropdown to each cart item in both desktop (POSCart) and mobile (CartBottomSheet). Thread staff data through mappers and RPC. Add new `revenueByStaff` computations in `useAccounting` and render "Par équipe" tables in `RevenuesPage`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Supabase (migration + RPC update), TanStack Query

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| **Migrate** | `supabase/migrations/<timestamp>_add_staff_to_transaction_items.sql` | Add `staff_id` column + update RPC |
| **Modify** | `types.ts:249-260` | Add `staffId?` and `staffName?` to `CartItem` |
| **Modify** | `modules/pos/mappers.ts` | Add `staff_id`/`staff_name` to row interfaces + both mapper functions |
| **Create** | `modules/pos/components/StaffSelector.tsx` | Compact staff dropdown for cart items |
| **Modify** | `modules/pos/components/POSCart.tsx` | Render StaffSelector per cart item |
| **Modify** | `modules/pos/components/CartBottomSheet.tsx` | Render StaffSelector per cart item (mobile) |
| **Modify** | `modules/pos/POSModule.tsx:42-75` | Pass `staffId`/`staffName` when creating cart items |
| **Modify** | `modules/pos/hooks/usePOS.ts` | Import `useTeam`, expose `allStaff`, pass through addToCart dedup |
| **Modify** | `modules/accounting/hooks/useAccounting.ts` | Add `revenueByStaffServices` and `revenueByStaffProducts` computations |
| **Modify** | `modules/accounting/components/RevenuesPage.tsx` | Unlock "Par équipe" tabs, render staff tables |

---

### Task 1: Database Migration — Add staff_id to transaction_items + Update RPC

**Files:**
- Create: `supabase/migrations/<timestamp>_add_staff_to_transaction_items.sql`

**Context:** The `transaction_items` table is at `supabase/migrations/20260326234138_financial_tables.sql:13-27`. The `create_transaction` RPC is at `supabase/migrations/20260326235114_functions_business.sql:1-66`. The RPC inserts into `transaction_items` using JSONB fields extracted from `v_item`. We need to add `staff_id` as a nullable column and update the RPC to read it from the JSONB payload.

- [ ] **Step 1: Create the migration file**

```bash
cd "/Users/sims/Casa de Chicas/Salon-Saas"
supabase migration new add_staff_to_transaction_items
```

- [ ] **Step 2: Write the migration SQL**

Write this content to the newly created migration file (the exact filename will have a timestamp prefix):

```sql
-- Add staff_id to transaction_items for per-item staff attribution
ALTER TABLE transaction_items
ADD COLUMN staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
ADD COLUMN staff_name TEXT;

-- Update create_transaction to persist staff_id and staff_name from cart items
CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_total NUMERIC(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_payment_total NUMERIC(10,2) := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'stylist', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create transactions';
  END IF;

  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total != v_total THEN
    RAISE EXCEPTION 'Payment total (%) does not match transaction total (%)', v_payment_total, v_total;
  END IF;

  INSERT INTO transactions (salon_id, client_id, total, notes, created_by)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid())
  RETURNING id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transaction_items (
      transaction_id, salon_id, reference_id, type, name, variant_name,
      price, original_price, quantity, cost, note, staff_id, staff_name
    ) VALUES (
      v_transaction_id, p_salon_id,
      (v_item->>'reference_id')::uuid, v_item->>'type', v_item->>'name', v_item->>'variant_name',
      (v_item->>'price')::numeric, (v_item->>'original_price')::numeric,
      (v_item->>'quantity')::integer, (v_item->>'cost')::numeric, v_item->>'note',
      (v_item->>'staff_id')::uuid, v_item->>'staff_name'
    );

    IF v_item->>'type' = 'PRODUCT' AND (v_item->>'reference_id') IS NOT NULL THEN
      UPDATE products SET stock = GREATEST(0, stock - (v_item->>'quantity')::integer), updated_at = now()
      WHERE id = (v_item->>'reference_id')::uuid AND salon_id = p_salon_id;
    END IF;
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 3: Push the migration to remote Supabase**

```bash
SUPABASE_ACCESS_TOKEN=sbp_f55ffb94f2f5b84fa67dfeec68570281b80917fe npx supabase@latest db push --linked
```

- [ ] **Step 4: Regenerate TypeScript types**

```bash
SUPABASE_ACCESS_TOKEN=sbp_f55ffb94f2f5b84fa67dfeec68570281b80917fe npx supabase@latest gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ lib/database.types.ts
git commit -m "feat: add staff_id to transaction_items and update create_transaction RPC"
```

---

### Task 2: Extend CartItem Type + POS Mappers

**Files:**
- Modify: `types.ts:249-260`
- Modify: `modules/pos/mappers.ts`

**Context:** `CartItem` interface is at `types.ts:249-260`. `TransactionItemRow` is at `modules/pos/mappers.ts:6-17`. The `toTransaction` mapper is at `mappers.ts:41-84` and converts DB rows → frontend types. The `toTransactionRpcPayload` mapper is at `mappers.ts:88-128` and converts frontend types → RPC JSONB.

- [ ] **Step 1: Add staffId and staffName to CartItem**

In `types.ts`, add two optional fields to the `CartItem` interface after the `note` field (line 260):

```typescript
export interface CartItem {
  id: string;
  referenceId: string;
  type: 'SERVICE' | 'PRODUCT';
  name: string;
  variantName?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  cost?: number;
  note?: string;
  staffId?: string;
  staffName?: string;
}
```

- [ ] **Step 2: Add staff fields to TransactionItemRow**

In `modules/pos/mappers.ts`, add `staff_id` and `staff_name` to the `TransactionItemRow` interface (after line 16):

```typescript
export interface TransactionItemRow {
  id: string;
  reference_id: string;
  type: string;
  name: string;
  variant_name: string | null;
  price: number;
  original_price: number | null;
  quantity: number;
  cost: number | null;
  note: string | null;
  staff_id: string | null;
  staff_name: string | null;
}
```

- [ ] **Step 3: Update toTransaction mapper to include staff fields**

In `modules/pos/mappers.ts`, update the items mapping inside `toTransaction` (around line 46-57) to include `staffId` and `staffName`:

```typescript
  const items: CartItem[] = (row.transaction_items ?? []).map(item => ({
    id: item.id,
    referenceId: item.reference_id,
    type: item.type as 'SERVICE' | 'PRODUCT',
    name: item.name,
    variantName: item.variant_name ?? undefined,
    price: item.price,
    originalPrice: item.original_price ?? undefined,
    quantity: item.quantity,
    cost: item.cost ?? undefined,
    note: item.note ?? undefined,
    staffId: item.staff_id ?? undefined,
    staffName: item.staff_name ?? undefined,
  }));
```

- [ ] **Step 4: Update toTransactionRpcPayload to include staff fields**

In `modules/pos/mappers.ts`, update the `p_items` mapping inside `toTransactionRpcPayload` (around line 94-104) to include `staff_id` and `staff_name`:

```typescript
  const p_items = cart.map(item => ({
    reference_id: item.referenceId,
    type: item.type,
    name: item.name,
    variant_name: item.variantName ?? null,
    price: item.price,
    original_price: item.originalPrice ?? item.price,
    quantity: item.quantity,
    cost: item.cost ?? 0,
    note: item.note ?? null,
    staff_id: item.staffId ?? null,
    staff_name: item.staffName ?? null,
  }));
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add types.ts modules/pos/mappers.ts
git commit -m "feat: add staffId/staffName to CartItem type and POS mappers"
```

---

### Task 3: Create StaffSelector Component

**Files:**
- Create: `modules/pos/components/StaffSelector.tsx`

**Context:** This is a compact dropdown that appears below each cart item's variant badge. It shows the assigned staff member or "Non attribué". On click, it opens a dropdown list of active team members from `useTeam()`. The component must be self-contained, receiving the current `staffId`, a list of staff, and an `onChange` callback.

`StaffMember` type (from `types.ts:116-150`) has `id`, `firstName`, `lastName`, `active`, `color`, and `photoUrl?`.

- [ ] **Step 1: Create StaffSelector.tsx**

Create `modules/pos/components/StaffSelector.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, X } from 'lucide-react';
import type { StaffMember } from '../../../types';

interface StaffSelectorProps {
  staffId?: string;
  staffName?: string;
  staffMembers: StaffMember[];
  onChange: (staffId: string | undefined, staffName: string | undefined) => void;
  expanded?: boolean; // true for services (show by default), false for products
}

export const StaffSelector: React.FC<StaffSelectorProps> = ({
  staffId,
  staffName,
  staffMembers,
  onChange,
  expanded = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeStaff = staffMembers.filter(s => s.active);
  const selected = staffId ? activeStaff.find(s => s.id === staffId) : null;

  // If not expanded and no staff assigned, show compact "assign" link
  if (!expanded && !staffId && !isOpen) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 mt-1 transition-colors"
      >
        <User size={10} />
        <span>Attribuer</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative mt-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border transition-colors ${
          staffId
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
      >
        <User size={10} />
        <span className="truncate max-w-[120px]">{staffName || 'Non attribué'}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {staffId && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(undefined, undefined); setIsOpen(false); }}
            className="ml-0.5 hover:text-red-500"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => { onChange(undefined, undefined); setIsOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${
              !staffId ? 'text-slate-900 font-medium' : 'text-slate-500'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
              <User size={10} className="text-slate-400" />
            </div>
            Non attribué
          </button>
          {activeStaff.map(member => (
            <button
              key={member.id}
              onClick={() => {
                onChange(member.id, `${member.firstName} ${member.lastName}`);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${
                staffId === member.id ? 'text-slate-900 font-medium bg-slate-50' : 'text-slate-700'
              }`}
            >
              {member.photoUrl ? (
                <img src={member.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                  style={{ backgroundColor: member.color || '#64748b' }}
                >
                  {member.firstName[0]}{member.lastName[0]}
                </div>
              )}
              {member.firstName} {member.lastName}
            </button>
          ))}
          {activeStaff.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">Aucun membre actif</div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/StaffSelector.tsx
git commit -m "feat: create StaffSelector component for POS cart items"
```

---

### Task 4: Wire Staff into POS Hook + Cart Item Creation

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`
- Modify: `modules/pos/POSModule.tsx`

**Context:** `usePOS` is at `modules/pos/hooks/usePOS.ts:1-128`. It manages cart state and exposes `addToCart`, `updateCartItem`. The `addToCart` function deduplicates items by `referenceId + variantName` (line 35-36). With staff tracking, items with different `staffId` should NOT be merged — so the dedup key must include `staffId`.

`POSModule.tsx` creates cart items at lines 51-63 (services) and 65-75 (products). These currently don't set `staffId`. We won't pre-assign staff during add — the user assigns staff after adding to cart via StaffSelector. But we do need the dedup key to consider `staffId` so that if the user later assigns different staff to the same service, a second add doesn't merge them.

`useTeam()` at `modules/team/hooks/useTeam.ts` returns `{ allStaff: StaffMember[], ... }`.

- [ ] **Step 1: Import useTeam and expose allStaff from usePOS**

In `modules/pos/hooks/usePOS.ts`, add the import and data source:

After line 6 (`import { useClients } ...`), add:
```typescript
import { useTeam } from '../../team/hooks/useTeam';
```

After line 19 (`const { products, productCategories } = useProducts();`), add:
```typescript
const { allStaff } = useTeam();
```

In the return object (around line 105-127), add `allStaff` to the Data section:
```typescript
    // Data
    services, serviceCategories,
    products, productCategories,
    clients,
    transactions,
    filteredItems,
    totals,
    allStaff,
```

- [ ] **Step 2: Update addToCart dedup to include staffId**

In `modules/pos/hooks/usePOS.ts`, update the dedup logic in `addToCart` (line 35-36):

Change:
```typescript
    const existingItemIndex = cart.findIndex(
      i => i.referenceId === item.referenceId && i.variantName === item.variantName
    );
```

To:
```typescript
    const existingItemIndex = cart.findIndex(
      i => i.referenceId === item.referenceId && i.variantName === item.variantName && i.staffId === item.staffId
    );
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add modules/pos/hooks/usePOS.ts
git commit -m "feat: expose allStaff from usePOS and include staffId in cart dedup"
```

---

### Task 5: Add StaffSelector to Desktop POSCart

**Files:**
- Modify: `modules/pos/components/POSCart.tsx`

**Context:** `POSCart` renders cart items at lines 120-172. Each item shows name, variant badge, note, price, and quantity controls. The `StaffSelector` should appear after the variant badge / note section and before the price. The component needs `staffMembers` (from `allStaff`), and calls `onUpdateCartItem` to set `staffId`/`staffName`.

POSCart's props interface is at lines 7-17. It currently receives `onEditItem` but we need `onUpdateCartItem` for inline staff changes (without opening the editor modal).

- [ ] **Step 1: Update POSCart props to include allStaff and onUpdateCartItem**

In `modules/pos/components/POSCart.tsx`, update the imports and interface:

Add to imports:
```typescript
import { StaffSelector } from './StaffSelector';
import type { StaffMember } from '../../../types';
```

Update the interface (after line 14 `onEditItem`):
```typescript
interface POSCartProps {
  cart: CartItem[];
  clients: Client[];
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onEditItem: (item: CartItem) => void;
  onUpdateCartItem: (id: string, updates: Partial<CartItem>) => void;
  allStaff: StaffMember[];
  totals: { subtotal: number; tax: number; total: number; vatRate: number };
  onCheckout: () => void;
}
```

Update the destructured props to include `onUpdateCartItem` and `allStaff`.

- [ ] **Step 2: Add StaffSelector to each cart item**

Inside the cart item rendering (around line 120-172), add the `StaffSelector` after the note display (after line 138) and before the closing `</div>` of the top section:

After:
```typescript
                      {item.note && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 italic">
                           <Tag size={10} /> {item.note}
                        </div>
                      )}
```

Add:
```typescript
                      <StaffSelector
                        staffId={item.staffId}
                        staffName={item.staffName}
                        staffMembers={allStaff}
                        onChange={(staffId, staffName) => onUpdateCartItem(item.id, { staffId, staffName })}
                        expanded={item.type === 'SERVICE'}
                      />
```

- [ ] **Step 3: Update POSModule to pass new props to POSCart**

In `modules/pos/POSModule.tsx`, update the `POSCart` usage (around line 103-113):

```typescript
        <POSCart
          cart={cart}
          clients={clients}
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onEditItem={setEditingItem}
          onUpdateCartItem={updateCartItem}
          allStaff={allStaff}
          totals={totals}
          onCheckout={() => setShowPaymentModal(true)}
        />
```

Also destructure `allStaff` and `updateCartItem` from `usePOS()` in the component (they're already returned, just need destructuring at line 14-31):

Add `allStaff` after `transactions` and ensure `updateCartItem` is already destructured (it is, at line 28).

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add modules/pos/components/POSCart.tsx modules/pos/POSModule.tsx
git commit -m "feat: add staff selector to desktop POS cart items"
```

---

### Task 6: Add StaffSelector to Mobile CartBottomSheet

**Files:**
- Modify: `modules/pos/components/CartBottomSheet.tsx`

**Context:** `CartBottomSheet` renders cart items similarly to `POSCart` but in a fullscreen mobile layout. Its props are defined at the top of the file. It needs the same `allStaff` and `onUpdateCartItem` props, and renders `StaffSelector` in the same position relative to each cart item.

- [ ] **Step 1: Read CartBottomSheet.tsx to find the cart item rendering**

Read the file to find the exact cart item rendering code and props interface.

- [ ] **Step 2: Update CartBottomSheet props**

Add to the props interface:
```typescript
  onUpdateCartItem: (id: string, updates: Partial<CartItem>) => void;
  allStaff: StaffMember[];
```

Add imports:
```typescript
import { StaffSelector } from './StaffSelector';
import type { StaffMember } from '../../../types';
```

- [ ] **Step 3: Add StaffSelector after each cart item's note/variant display**

Same pattern as POSCart: add `StaffSelector` after the note display, with `expanded={item.type === 'SERVICE'}`.

- [ ] **Step 4: Update POSModule to pass new props to CartBottomSheet**

In `modules/pos/POSModule.tsx`, update the `CartBottomSheet` usage (around line 124-137):

```typescript
          <CartBottomSheet
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            clients={clients}
            selectedClient={selectedClient}
            onSelectClient={setSelectedClient}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onEditItem={(item) => { setEditingItem(item); setIsCartOpen(false); }}
            onUpdateCartItem={updateCartItem}
            allStaff={allStaff}
            totals={totals}
            onCheckout={() => setShowPaymentModal(true)}
          />
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add modules/pos/components/CartBottomSheet.tsx modules/pos/POSModule.tsx
git commit -m "feat: add staff selector to mobile POS cart (CartBottomSheet)"
```

---

### Task 7: Add Revenue-by-Staff Computations to useAccounting

**Files:**
- Modify: `modules/accounting/hooks/useAccounting.ts`

**Context:** `useAccounting` already imports `useTeam` indirectly (staff members are identified by `staffId` on `CartItem`). Transaction items now carry `staffId` and `staffName`. We need two new `useMemo` computations:

1. `revenueByStaffServices` — groups SERVICE items by `staffId`, with member name, count, revenue, avg basket, % of total
2. `revenueByStaffProducts` — groups PRODUCT items by `staffId`, with member name, count, revenue, % of total

Items with `staffId === undefined/null` are grouped under "Non attribué".

- [ ] **Step 1: Add revenueByStaffServices computation**

In `modules/accounting/hooks/useAccounting.ts`, after the `revenueByServiceCategory` useMemo block (after line 201), add:

```typescript
  // --- Revenue by Staff (Services) ---
  const revenueByStaffServices = useMemo(() => {
    const map = new Map<string, { staffId: string | null; staffName: string; count: number; revenue: number }>();

    data.current.transactions.forEach((t: any) => {
      t.items.forEach((item: any) => {
        if (item.type !== 'SERVICE') return;
        const key = item.staffId || '__unassigned__';
        const name = item.staffName || 'Non attribué';
        if (!map.has(key)) map.set(key, { staffId: item.staffId || null, staffName: name, count: 0, revenue: 0 });
        const row = map.get(key)!;
        row.count += item.quantity || 1;
        row.revenue += item.price * (item.quantity || 1);
      });
    });

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map(r => ({
      ...r,
      avgBasket: r.count > 0 ? r.revenue / r.count : 0,
      percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }));
  }, [data.current.transactions]);
```

- [ ] **Step 2: Add revenueByStaffProducts computation**

Immediately after the above, add:

```typescript
  // --- Revenue by Staff (Products) ---
  const revenueByStaffProducts = useMemo(() => {
    const map = new Map<string, { staffId: string | null; staffName: string; count: number; revenue: number }>();

    data.current.transactions.forEach((t: any) => {
      t.items.forEach((item: any) => {
        if (item.type !== 'PRODUCT') return;
        const key = item.staffId || '__unassigned__';
        const name = item.staffName || 'Non attribué';
        if (!map.has(key)) map.set(key, { staffId: item.staffId || null, staffName: name, count: 0, revenue: 0 });
        const row = map.get(key)!;
        row.count += item.quantity || 1;
        row.revenue += item.price * (item.quantity || 1);
      });
    });

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map(r => ({
      ...r,
      percent: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }));
  }, [data.current.transactions]);
```

- [ ] **Step 3: Expose both in the return value**

In the return object (around line 402-422), add after `topProducts`:

```typescript
    revenueByStaffServices,
    revenueByStaffProducts,
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add modules/accounting/hooks/useAccounting.ts
git commit -m "feat: add revenue-by-staff computations to useAccounting"
```

---

### Task 8: Unlock "Par équipe" Tabs in RevenuesPage

**Files:**
- Modify: `modules/accounting/components/RevenuesPage.tsx`

**Context:** `RevenuesPage` is at `modules/accounting/components/RevenuesPage.tsx:1-173`. It has two locked "Par équipe" sub-tabs (services at line 78, products at line 115) that show a placeholder message. We need to:

1. Remove the `disabled: true` flag from both tabs
2. Replace the placeholder content with actual tables showing staff revenue data
3. Pull `revenueByStaffServices` and `revenueByStaffProducts` from the outlet context

- [ ] **Step 1: Add staff data to the destructured outlet context**

At line 14-19, update the destructured context:

```typescript
  const {
    serviceRevenue, productRevenue,
    prevServiceRevenue, prevProductRevenue,
    revenueByServiceCategory, revenueByProductCategory,
    revenueByStaffServices, revenueByStaffProducts,
    calcTrend,
  } = useOutletContext<FinancesOutletContext>();
```

- [ ] **Step 2: Remove Lock import if no longer needed, add User import**

Update imports:

```typescript
import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
```

(Remove `Lock` from the import since we're unlocking both tabs.)

- [ ] **Step 3: Unlock services "Par équipe" tab**

At line 78, change:
```typescript
              { id: 'PAR_EQUIPE' as ServiceSubTab, label: 'Par équipe', disabled: true },
```
To:
```typescript
              { id: 'PAR_EQUIPE' as ServiceSubTab, label: 'Par équipe' },
```

Update the button rendering to remove disabled logic. Change the entire sub-tab button map (lines 76-88) to:

```typescript
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {[
              { id: 'PAR_CATEGORIE' as ServiceSubTab, label: 'Par catégorie' },
              { id: 'PAR_EQUIPE' as ServiceSubTab, label: 'Par équipe' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setServiceSubTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  serviceSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
```

- [ ] **Step 4: Replace services "Par équipe" placeholder with staff table**

Replace lines 93-98 (the placeholder div) with:

```typescript
          {serviceSubTab === 'PAR_EQUIPE' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs font-semibold text-slate-500 uppercase">
                    <th className="px-4 py-3">Membre</th>
                    <th className="px-4 py-3 text-right">Prestations</th>
                    <th className="px-4 py-3 text-right">CA</th>
                    <th className="px-4 py-3 text-right">Panier Moyen</th>
                    <th className="px-4 py-3 text-right">% du total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revenueByStaffServices.map((row, idx) => (
                    <tr key={row.staffId || idx} className="hover:bg-slate-50 transition-colors text-sm">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                            <Users size={12} className="text-slate-400" />
                          </div>
                          <span className={`font-medium ${row.staffId ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                            {row.staffName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(row.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatPrice(row.avgBasket)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{row.percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {revenueByStaffServices.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Aucune donnée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
```

- [ ] **Step 5: Unlock products "Par équipe" tab**

At the products sub-tab section (around line 115), change:
```typescript
              { id: 'PAR_EQUIPE' as ProductSubTab, label: 'Par équipe', disabled: true },
```
To:
```typescript
              { id: 'PAR_EQUIPE' as ProductSubTab, label: 'Par équipe' },
```

Update the entire products sub-tab button map similarly to remove disabled logic:

```typescript
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {[
              { id: 'PAR_CATEGORIE' as ProductSubTab, label: 'Par catégorie' },
              { id: 'TOUS' as ProductSubTab, label: 'Tous les produits' },
              { id: 'PAR_EQUIPE' as ProductSubTab, label: 'Par équipe' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setProductSubTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  productSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
```

- [ ] **Step 6: Replace products "Par équipe" placeholder with staff table**

Replace lines 163-168 (the placeholder div) with:

```typescript
          {productSubTab === 'PAR_EQUIPE' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs font-semibold text-slate-500 uppercase">
                    <th className="px-4 py-3">Membre</th>
                    <th className="px-4 py-3 text-right">Qté vendue</th>
                    <th className="px-4 py-3 text-right">CA</th>
                    <th className="px-4 py-3 text-right">% du total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revenueByStaffProducts.map((row, idx) => (
                    <tr key={row.staffId || idx} className="hover:bg-slate-50 transition-colors text-sm">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                            <Users size={12} className="text-slate-400" />
                          </div>
                          <span className={`font-medium ${row.staffId ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                            {row.staffName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(row.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{row.percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {revenueByStaffProducts.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">Aucune donnée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
```

- [ ] **Step 7: Verify build passes**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add modules/accounting/components/RevenuesPage.tsx
git commit -m "feat: unlock Par équipe revenue views with staff breakdown tables"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ `staff_id UUID REFERENCES staff_members(id)` on `transaction_items` → Task 1
- ✅ `CartItem` gets `staffId?` and `staffName?` → Task 2
- ✅ POS mapper round-trip (DB ↔ frontend) → Task 2
- ✅ `create_transaction` RPC updated → Task 1
- ✅ Staff selector per cart item → Tasks 3, 5, 6
- ✅ Services: dropdown shown expanded → Task 3 (`expanded` prop)
- ✅ Products: dropdown collapsed by default → Task 3 (`expanded` default false)
- ✅ Staff name stored on cart item → Task 3 (onChange sets staffName)
- ✅ "Non attribué" default → Task 3
- ✅ Services Par équipe: Membre, Nb prestations, CA, Panier moyen, % du total → Task 8
- ✅ Produits Par équipe: Membre, Qté vendue, CA, % du total → Task 8
- ✅ Items with staff_id=NULL grouped under "Non attribué" → Task 7

**2. Placeholder scan:** No TBDs, TODOs, or vague instructions found.

**3. Type consistency:**
- `staffId?: string` and `staffName?: string` used consistently in CartItem, StaffSelector, mappers, and useAccounting
- `revenueByStaffServices` and `revenueByStaffProducts` names consistent between Task 7 (definition) and Task 8 (consumption)
- `staff_id` and `staff_name` used consistently in SQL migration, RPC, and mapper row interfaces
