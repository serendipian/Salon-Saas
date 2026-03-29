# Appointment-to-POS Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow cashiers to import pending appointments into the POS cart, pre-filled with client, services, staff, and prices — then complete payment as normal.

**Architecture:** Add `appointment_id` FK to `transactions` table, create a new "Rendez-vous" tab in the POS catalog that shows today's eligible appointments, and wire an import flow that converts appointment data into cart items. On payment completion, the linked appointment is marked as COMPLETED.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL migration + RPC update), TanStack Query, Tailwind CSS

---

## File Structure

```
New files:
  supabase/migrations/2026XXXX_add_appointment_to_transactions.sql  — DB migration
  modules/pos/components/PendingAppointments.tsx                    — Appointment cards for POS

Modified files:
  types.ts                                    — Add appointmentId to Transaction
  modules/pos/mappers.ts                      — Map appointment_id in RPC + query
  modules/pos/hooks/usePOS.ts                 — Add APPOINTMENTS view mode + import logic
  modules/pos/components/POSCatalog.tsx        — Add 4th tab + render PendingAppointments
  modules/pos/POSModule.tsx                   — Wire appointment import handler
  hooks/useTransactions.ts                    — Pass appointmentId through to RPC
```

---

### Task 1: Database Migration — Add appointment_id to transactions

**Files:**
- Create: `supabase/migrations/20260329130000_add_appointment_to_transactions.sql`

This migration adds a nullable `appointment_id` column to the `transactions` table so we can link a transaction back to the appointment it originated from. It also updates the `create_transaction` RPC to accept and store this new column, and adds a `COMPLETED` status update on the appointment when a transaction is created from it.

- [ ] **Step 1: Create the migration file**

```sql
-- Link transactions back to the appointment they were created from
ALTER TABLE transactions
ADD COLUMN appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- Index for lookups (e.g., "has this appointment been paid?")
CREATE INDEX idx_transactions_appointment_id ON transactions(appointment_id);

-- Unique constraint: one transaction per appointment (prevents double-charging)
CREATE UNIQUE INDEX idx_transactions_appointment_id_unique ON transactions(appointment_id) WHERE appointment_id IS NOT NULL;

-- Replace create_transaction to accept p_appointment_id
CREATE OR REPLACE FUNCTION create_transaction(
  p_salon_id UUID,
  p_client_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_total NUMERIC(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_payment_total NUMERIC(10,2) := 0;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = p_salon_id AND profile_id = auth.uid()
      AND role IN ('owner', 'manager', 'stylist', 'receptionist')
      AND deleted_at IS NULL AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You do not have permission to create transactions';
  END IF;

  -- Calculate totals
  SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::integer), 0)
  INTO v_total FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM((pay->>'amount')::numeric), 0)
  INTO v_payment_total FROM jsonb_array_elements(p_payments) AS pay;

  IF v_payment_total != v_total THEN
    RAISE EXCEPTION 'Payment total (%) does not match transaction total (%)', v_payment_total, v_total;
  END IF;

  -- Insert transaction with optional appointment_id
  INSERT INTO transactions (salon_id, client_id, total, notes, created_by, appointment_id)
  VALUES (p_salon_id, p_client_id, v_total, p_notes, auth.uid(), p_appointment_id)
  RETURNING id INTO v_transaction_id;

  -- Insert items
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

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO transaction_payments (transaction_id, salon_id, method, amount)
    VALUES (v_transaction_id, p_salon_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- If linked to an appointment, mark it as COMPLETED
  IF p_appointment_id IS NOT NULL THEN
    UPDATE appointments SET status = 'COMPLETED', updated_at = now()
    WHERE id = p_appointment_id AND salon_id = p_salon_id;

    -- Also complete the group if all appointments in the group are completed
    UPDATE appointment_groups SET status = 'COMPLETED', updated_at = now()
    WHERE id = (SELECT group_id FROM appointments WHERE id = p_appointment_id)
      AND NOT EXISTS (
        SELECT 1 FROM appointments
        WHERE group_id = (SELECT group_id FROM appointments WHERE id = p_appointment_id)
          AND status != 'COMPLETED' AND deleted_at IS NULL AND id != p_appointment_id
      );
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push --include-all`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260329130000_add_appointment_to_transactions.sql
git commit -m "feat: add appointment_id to transactions and update create_transaction RPC"
```

---

### Task 2: Type & Mapper Updates

**Files:**
- Modify: `types.ts` — Add `appointmentId` to `Transaction`
- Modify: `modules/pos/mappers.ts` — Map `appointment_id` in both directions
- Modify: `hooks/useTransactions.ts` — Accept and pass `appointmentId`

- [ ] **Step 1: Add `appointmentId` to the `Transaction` interface in `types.ts`**

Find the `Transaction` interface and add `appointmentId` after `clientId`:

```typescript
export interface Transaction {
  id: string;
  date: string;
  total: number;
  clientName?: string;
  clientId?: string;
  appointmentId?: string;
  items: CartItem[];
  payments: PaymentEntry[];
}
```

- [ ] **Step 2: Update `TransactionRow` in `modules/pos/mappers.ts`**

Add `appointment_id` to the `TransactionRow` interface:

```typescript
export interface TransactionRow {
  id: string;
  salon_id: string;
  client_id: string | null;
  appointment_id: string | null;
  date: string;
  total: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  transaction_items: TransactionItemRow[];
  transaction_payments: TransactionPaymentRow[];
  clients: { first_name: string; last_name: string } | null;
}
```

- [ ] **Step 3: Update `toTransaction` in `modules/pos/mappers.ts`**

Add `appointmentId` to the return value:

```typescript
return {
  id: row.id,
  date: row.date,
  total: row.total,
  clientName,
  clientId: row.client_id ?? undefined,
  appointmentId: row.appointment_id ?? undefined,
  items,
  payments,
};
```

- [ ] **Step 4: Update `toTransactionRpcPayload` in `modules/pos/mappers.ts`**

Add `appointmentId` parameter and include it in the return:

```typescript
export function toTransactionRpcPayload(
  cart: CartItem[],
  payments: PaymentEntry[],
  clientId: string | undefined,
  salonId: string,
  appointmentId?: string
) {
  // ... existing p_items and p_payments logic unchanged ...

  return {
    p_salon_id: salonId,
    p_client_id: clientId ?? null,
    p_appointment_id: appointmentId ?? null,
    p_items,
    p_payments,
  };
}
```

- [ ] **Step 5: Update `useTransactions.ts` to accept and pass `appointmentId`**

Update the mutation and `addTransaction` function:

```typescript
const addTransactionMutation = useMutation({
  mutationFn: async ({
    items,
    payments,
    clientId,
    appointmentId,
  }: {
    items: CartItem[];
    payments: PaymentEntry[];
    clientId?: string;
    appointmentId?: string;
  }) => {
    const payload = toTransactionRpcPayload(items, payments, clientId, salonId, appointmentId);
    const { error } = await supabase.rpc('create_transaction', payload);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
    queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
  },
  onError: toastOnError("Impossible de créer la transaction"),
});

const addTransaction = (items: CartItem[], payments: PaymentEntry[], clientId?: string, appointmentId?: string) =>
  addTransactionMutation.mutateAsync({ items, payments, clientId, appointmentId });
```

Note: `appointments` query is also invalidated on success so the POS appointment list updates in real time.

- [ ] **Step 6: Update the `transactions` query to include `appointment_id`**

In `useTransactions.ts`, update the `.select()` call:

```typescript
const { data, error } = await supabase
  .from('transactions')
  .select('*, transaction_items(*), transaction_payments(*), clients(first_name, last_name)')
  .eq('salon_id', salonId)
  .order('date', { ascending: false });
```

No change needed — the `*` wildcard already includes `appointment_id`. The mapper change in Step 3 handles the mapping.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add types.ts modules/pos/mappers.ts hooks/useTransactions.ts
git commit -m "feat: thread appointmentId through Transaction type, mappers, and useTransactions"
```

---

### Task 3: POS Hook — Appointments View Mode + Import Logic

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts`

This task adds a new `APPOINTMENTS` view mode to the POS, fetches today's pending appointments, and provides an `importAppointment` function that pre-fills the cart.

- [ ] **Step 1: Add APPOINTMENTS to POSViewMode**

```typescript
export type POSViewMode = 'SERVICES' | 'PRODUCTS' | 'HISTORY' | 'APPOINTMENTS';
```

- [ ] **Step 2: Import useAppointments and add pending appointments logic**

Add imports at the top of `usePOS.ts`:

```typescript
import { useAppointments } from '../../appointments/hooks/useAppointments';
```

Inside the hook, after the existing data fetches, add:

```typescript
const { allAppointments } = useAppointments();
```

- [ ] **Step 3: Add pendingAppointments computed value**

Add a `useMemo` that filters appointments to show today's SCHEDULED ones and overdue SCHEDULED ones from previous days:

```typescript
const pendingAppointments = useMemo(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  return allAppointments
    .filter(a => {
      if (a.status !== 'SCHEDULED') return false;
      // Today's appointments OR overdue from previous days
      return a.date < tomorrowStart;
    })
    .sort((a, b) => {
      const aIsOverdue = a.date < todayStart;
      const bIsOverdue = b.date < todayStart;
      // Overdue first, then by scheduled time
      if (aIsOverdue && !bIsOverdue) return -1;
      if (!aIsOverdue && bIsOverdue) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
}, [allAppointments]);
```

- [ ] **Step 4: Add `appointmentId` state and `importAppointment` function**

Add state to track which appointment the current cart originated from:

```typescript
const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
```

Add the import function that pre-fills the cart from an appointment's service blocks. An appointment may be a single service, or part of a group (multiple services for one client). We handle both:

```typescript
const importAppointment = (appointment: Appointment) => {
  // Find all appointments in the same group (or just this one if no group)
  const groupAppointments = appointment.groupId
    ? allAppointments.filter(a => a.groupId === appointment.groupId && a.status === 'SCHEDULED')
    : [appointment];

  // Clear current cart and set client
  setCart([]);
  const client = clients.find(c => c.id === appointment.clientId);
  setSelectedClient(client ?? null);
  setLinkedAppointmentId(appointment.groupId ?? appointment.id);

  // Convert each appointment in the group to a cart item
  const cartItems: CartItem[] = groupAppointments.map(appt => ({
    id: crypto.randomUUID(),
    referenceId: appt.serviceId,
    type: 'SERVICE' as const,
    name: appt.serviceName,
    variantName: appt.variantName || undefined,
    price: appt.price,
    originalPrice: appt.price,
    quantity: 1,
    staffId: appt.staffId || undefined,
    staffName: appt.staffName || undefined,
  }));

  setCart(cartItems);
  setViewMode('SERVICES');
};
```

- [ ] **Step 5: Update `processTransaction` to pass `appointmentId`**

```typescript
const processTransaction = async (payments: PaymentEntry[]) => {
  await addTransaction(cart, payments, selectedClient?.id, linkedAppointmentId ?? undefined);
  clearCart();
  setLinkedAppointmentId(null);
  setViewMode('HISTORY');
};
```

- [ ] **Step 6: Update `clearCart` to also clear linked appointment**

```typescript
const clearCart = () => {
  setCart([]);
  setSelectedClient(null);
  setLinkedAppointmentId(null);
};
```

- [ ] **Step 7: Export new values from the hook**

Add to the return object:

```typescript
return {
  // ... existing exports ...
  pendingAppointments,
  linkedAppointmentId,
  importAppointment,
};
```

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: Build succeeds (POSCatalog will show a TS error about the unknown APPOINTMENTS mode — that's expected and fixed in Task 5).

- [ ] **Step 9: Commit**

```bash
git add modules/pos/hooks/usePOS.ts
git commit -m "feat: add APPOINTMENTS view mode and importAppointment logic to usePOS"
```

---

### Task 4: PendingAppointments Component

**Files:**
- Create: `modules/pos/components/PendingAppointments.tsx`

A list of appointment cards showing today's pending and overdue appointments. Each card is clickable to import into cart.

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import { Calendar, Clock, User, AlertTriangle } from 'lucide-react';
import type { Appointment } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { useMediaQuery } from '../../../context/MediaQueryContext';

interface PendingAppointmentsProps {
  appointments: Appointment[];
  onImport: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
}

export const PendingAppointments: React.FC<PendingAppointmentsProps> = ({
  appointments,
  onImport,
  linkedAppointmentId,
}) => {
  const { isMobile } = useMediaQuery();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Calendar size={48} strokeWidth={1} className="mb-4 opacity-50" />
        <p className="font-medium text-sm">Aucun rendez-vous en attente</p>
        <p className="text-xs mt-1">Les rendez-vous confirmés du jour apparaîtront ici</p>
      </div>
    );
  }

  // Group by groupId (null = standalone appointment)
  const grouped = new Map<string, Appointment[]>();
  appointments.forEach(appt => {
    const key = appt.groupId ?? appt.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(appt);
  });

  return (
    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-3'}`}>
      {Array.from(grouped.entries()).map(([groupKey, groupAppts]) => {
        const primary = groupAppts[0];
        const isOverdue = new Date(primary.date) < todayStart;
        const isLinked = linkedAppointmentId === groupKey;
        const totalPrice = groupAppts.reduce((sum, a) => sum + a.price, 0);

        return (
          <button
            key={groupKey}
            onClick={() => onImport(primary)}
            disabled={isLinked}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              isLinked
                ? 'border-green-300 bg-green-50 opacity-60 cursor-not-allowed'
                : isOverdue
                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400 hover:shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-md'
            }`}
          >
            {/* Overdue badge */}
            {isOverdue && (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold mb-2">
                <AlertTriangle size={12} />
                <span>En retard</span>
              </div>
            )}

            {/* Linked badge */}
            {isLinked && (
              <div className="text-xs font-semibold text-green-600 mb-2">
                Dans le panier
              </div>
            )}

            {/* Client name */}
            <div className="font-semibold text-slate-900 text-sm mb-1">
              {primary.clientName || <span className="text-slate-400 italic">Client de passage</span>}
            </div>

            {/* Time */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
              <Clock size={12} />
              <span>
                {new Date(primary.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Services list */}
            <div className="space-y-1.5 mb-3">
              {groupAppts.map(appt => (
                <div key={appt.id} className="flex justify-between items-center text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-700 font-medium truncate block">{appt.serviceName}</span>
                    {appt.variantName && (
                      <span className="text-slate-400">{appt.variantName}</span>
                    )}
                  </div>
                  <span className="text-slate-600 font-medium ml-2 shrink-0">{formatPrice(appt.price)}</span>
                </div>
              ))}
            </div>

            {/* Staff + total */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User size={12} />
                <span className="truncate max-w-[120px]">
                  {primary.staffName || 'Non attribué'}
                </span>
              </div>
              <span className="font-bold text-slate-900 text-sm">{formatPrice(totalPrice)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (component is created but not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/PendingAppointments.tsx
git commit -m "feat: create PendingAppointments component for POS"
```

---

### Task 5: POSCatalog — Add Appointments Tab

**Files:**
- Modify: `modules/pos/components/POSCatalog.tsx`

Add a 4th "Rendez-vous" tab to the POS catalog and render the PendingAppointments component when active.

- [ ] **Step 1: Update POSCatalog props**

Add new props to `POSCatalogProps`:

```typescript
import { Calendar } from 'lucide-react';
import { PendingAppointments } from './PendingAppointments';
import type { Appointment } from '../../../types';

interface POSCatalogProps {
  viewMode: POSViewMode;
  setViewMode: (mode: POSViewMode) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  serviceCategories: ServiceCategory[];
  productCategories: ProductCategory[];
  filteredItems: (Service | Product)[];
  transactions: Transaction[];
  onServiceClick: (s: Service) => void;
  onProductClick: (p: Product) => void;
  onReceiptClick: (t: Transaction) => void;
  pendingAppointments: Appointment[];
  onImportAppointment: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
}
```

Update the function signature to destructure the new props:

```typescript
export const POSCatalog: React.FC<POSCatalogProps> = ({
  viewMode, setViewMode,
  searchTerm, setSearchTerm,
  selectedCategory, setSelectedCategory,
  serviceCategories, productCategories,
  filteredItems,
  transactions,
  onServiceClick,
  onProductClick,
  onReceiptClick,
  pendingAppointments,
  onImportAppointment,
  linkedAppointmentId,
}) => {
```

- [ ] **Step 2: Add the APPOINTMENTS tab button**

After the HISTORY button in the tab bar, add:

```tsx
<button
  onClick={() => { setViewMode('APPOINTMENTS'); }}
  className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 relative ${viewMode === 'APPOINTMENTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
>
  <Calendar size={16} />
  <span className="hidden sm:inline">Rendez-vous</span>
  {pendingAppointments.length > 0 && (
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
      {pendingAppointments.length > 9 ? '9+' : pendingAppointments.length}
    </span>
  )}
</button>
```

- [ ] **Step 3: Hide category row for APPOINTMENTS view**

Update the category visibility condition from:
```tsx
{viewMode !== 'HISTORY' && !(isMobile && searchTerm.length > 0) && (
```
to:
```tsx
{viewMode !== 'HISTORY' && viewMode !== 'APPOINTMENTS' && !(isMobile && searchTerm.length > 0) && (
```

- [ ] **Step 4: Add APPOINTMENTS content section**

After the History View block in the content area, add:

```tsx
{/* Appointments View */}
{viewMode === 'APPOINTMENTS' && (
  <PendingAppointments
    appointments={pendingAppointments}
    onImport={onImportAppointment}
    linkedAppointmentId={linkedAppointmentId}
  />
)}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add modules/pos/components/POSCatalog.tsx
git commit -m "feat: add Rendez-vous tab to POS catalog"
```

---

### Task 6: POSModule — Wire Everything Together

**Files:**
- Modify: `modules/pos/POSModule.tsx`

Pass the new appointment-related props through from usePOS to POSCatalog.

- [ ] **Step 1: Destructure new values from usePOS**

Update the destructuring at the top of the component:

```typescript
const {
  viewMode, setViewMode,
  searchTerm, setSearchTerm,
  selectedCategory, setSelectedCategory,
  selectedClient, setSelectedClient,
  cart,
  services, serviceCategories,
  products, productCategories,
  transactions,
  clients, allStaff,
  filteredItems,
  totals,
  addToCart,
  updateCartItem,
  updateQuantity,
  removeFromCart,
  processTransaction,
  pendingAppointments,
  linkedAppointmentId,
  importAppointment,
} = usePOS();
```

- [ ] **Step 2: Pass new props to POSCatalog**

Add the three new props to the `<POSCatalog>` JSX:

```tsx
<POSCatalog
  viewMode={viewMode}
  setViewMode={setViewMode}
  searchTerm={searchTerm}
  setSearchTerm={setSearchTerm}
  selectedCategory={selectedCategory}
  setSelectedCategory={setSelectedCategory}
  serviceCategories={serviceCategories}
  productCategories={productCategories}
  filteredItems={filteredItems}
  transactions={transactions}
  onServiceClick={handleServiceClick}
  onProductClick={handleProductClick}
  onReceiptClick={setReceiptTransaction}
  pendingAppointments={pendingAppointments}
  onImportAppointment={importAppointment}
  linkedAppointmentId={linkedAppointmentId}
/>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/POSModule.tsx
git commit -m "feat: wire appointment import through POSModule to POSCatalog"
```

---

### Task 7: Manual Testing & Edge Case Verification

**Files:** None (testing only)

- [ ] **Step 1: Verify the full flow**

Run: `npm run dev`

Test the following scenarios in the browser:

1. **POS Rendez-vous tab visible** — Navigate to Caisse, verify a 4th "Rendez-vous" tab appears with a Calendar icon
2. **Badge count** — If there are SCHEDULED appointments for today, verify the blue badge shows the correct count
3. **Empty state** — If no pending appointments exist, verify the empty state message renders
4. **Import flow** — Click an appointment card → verify:
   - Cart is pre-filled with the service(s) from the appointment
   - Client is auto-selected
   - Staff is pre-assigned per cart item
   - Price matches the appointment price
5. **Group import** — For a grouped appointment (multi-service), verify all services in the group are added to cart
6. **Cart is editable** — After import, verify you can add more items, change staff, adjust prices, remove items
7. **Payment completion** — Process payment → verify:
   - Transaction is created successfully
   - Appointment disappears from the pending list (status changed to COMPLETED)
   - The "Dans le panier" badge is gone
8. **Double-charge prevention** — After paying for an appointment, refresh and verify it no longer appears in the pending list
9. **Overdue appointments** — Create an appointment for yesterday with SCHEDULED status → verify it shows with the amber "En retard" badge and appears first in the list
10. **Mobile** — Test on mobile viewport: verify the Rendez-vous tab icon shows, cards stack in single column, import works correctly

- [ ] **Step 2: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address edge cases found during manual testing"
```

---

## Summary

| Task | Description | Files |
|------|------------|-------|
| 1 | DB migration: `appointment_id` on transactions + RPC update | 1 new migration |
| 2 | Type & mapper updates: thread `appointmentId` through | 3 modified |
| 3 | POS hook: APPOINTMENTS mode + `importAppointment` | 1 modified |
| 4 | PendingAppointments component | 1 new |
| 5 | POSCatalog: add 4th tab | 1 modified |
| 6 | POSModule: wire props through | 1 modified |
| 7 | Manual testing & edge cases | 0 |
