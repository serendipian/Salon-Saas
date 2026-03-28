# Plan 5C: POS Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the POS module fully usable on mobile devices with bottom-sheet cart, fullscreen modals, and correct VAT extraction.

**Architecture:** Mobile layout uses a mini cart bar + fullscreen cart sheet instead of the desktop sidebar. All four modals become fullscreen overlays on mobile via `createPortal`. Desktop layout unchanged — all changes gated behind `useMediaQuery()`. Tax formula corrected for TTC pricing.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `createPortal`, `useMediaQuery()` from `context/MediaQueryContext.tsx`, CSS custom properties for z-index.

**Spec:** `docs/superpowers/specs/2026-03-28-plan-5c-pos-mobile-design.md`

---

## File Structure

```
modules/pos/
  POSModule.tsx                    # Modify: conditional mobile/desktop layout
  hooks/usePOS.ts                  # Modify: fix tax formula
  components/
    POSCart.tsx                    # Unchanged (desktop only)
    POSCatalog.tsx                # Modify: category snap, history cards, auto-hide pills
    POSModals.tsx                 # Modify: fullscreen mobile versions
    PaymentModal.tsx              # Modify: fullscreen mobile version
    MiniCartBar.tsx               # Create: mobile mini cart bar
    CartBottomSheet.tsx           # Create: mobile fullscreen cart sheet
```

---

### Task 1: Fix VAT extraction formula (TTC pricing)

**Files:**
- Modify: `modules/pos/hooks/usePOS.ts:98-103`

This is the simplest task and a standalone bug fix. Do it first.

- [ ] **Step 1: Fix the tax formula in usePOS.ts**

In `modules/pos/hooks/usePOS.ts`, find the `totals` useMemo (around line 98-103):

```typescript
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = (salonSettings.vatRate || 20) / 100;
    const tax = subtotal * taxRate;
    return { subtotal, tax, total: subtotal };
  }, [cart, salonSettings.vatRate]);
```

Replace the `tax` line with the correct TTC extraction formula:

```typescript
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = (salonSettings.vatRate || 20) / 100;
    const tax = subtotal * taxRate / (1 + taxRate);
    return { subtotal, tax, total: subtotal };
  }, [cart, salonSettings.vatRate]);
```

**What changed:** `subtotal * taxRate` → `subtotal * taxRate / (1 + taxRate)`. This correctly extracts VAT from TTC (tax-inclusive) prices. For a 100€ subtotal with 20% VAT: old formula gave 20€ (wrong), new gives 16.67€ (correct — the VAT component of 100€ TTC).

- [ ] **Step 2: Also fix the ReceiptModal VAT calculation**

In `modules/pos/components/POSModals.tsx`, the `ReceiptModal` has its own VAT calculation (around line 150):

```typescript
  const vatAmount = transaction.total * (vatRate / 100);
```

Replace with:

```typescript
  const vatAmount = transaction.total * (vatRate / 100) / (1 + vatRate / 100);
```

- [ ] **Step 3: Also fix the POSCart TVA label to be dynamic**

In `modules/pos/components/POSCart.tsx`, line 184 shows a hardcoded "TVA (20%)". This should use the actual rate from settings. But POSCart doesn't have access to `salonSettings` — it receives `totals` as a prop.

Add `vatRate` to the totals object. In `modules/pos/hooks/usePOS.ts`, update the return:

```typescript
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = (salonSettings.vatRate || 20) / 100;
    const tax = subtotal * taxRate / (1 + taxRate);
    return { subtotal, tax, total: subtotal, vatRate: salonSettings.vatRate || 20 };
  }, [cart, salonSettings.vatRate]);
```

Then in `modules/pos/components/POSCart.tsx`, update the `totals` type in the interface (line 15):

```typescript
  totals: { subtotal: number; tax: number; total: number; vatRate: number };
```

And update the TVA label (line 184):

```typescript
               <span>TVA ({totals.vatRate}%)</span>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no new errors.

- [ ] **Step 5: Commit**

```bash
git add modules/pos/hooks/usePOS.ts modules/pos/components/POSCart.tsx modules/pos/components/POSModals.tsx
git commit -m "fix: correct VAT extraction formula for TTC pricing, dynamic TVA label"
```

---

### Task 2: Create MiniCartBar component

**Files:**
- Create: `modules/pos/components/MiniCartBar.tsx`

- [ ] **Step 1: Create MiniCartBar.tsx**

Create `modules/pos/components/MiniCartBar.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { formatPrice } from '../../../lib/format';

interface MiniCartBarProps {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export const MiniCartBar: React.FC<MiniCartBarProps> = ({ itemCount, total, onOpen }) => {
  const [bounce, setBounce] = useState(false);

  // Trigger bounce animation when itemCount changes (and is > 0)
  useEffect(() => {
    if (itemCount > 0) {
      setBounce(true);
      const timer = setTimeout(() => setBounce(false), 300);
      return () => clearTimeout(timer);
    }
  }, [itemCount]);

  if (itemCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`fixed left-3 right-3 h-[44px] bg-slate-900 text-white rounded-xl flex items-center justify-between px-4 shadow-lg transition-transform ${
        bounce ? 'scale-[1.03]' : 'scale-100'
      }`}
      style={{
        bottom: 'calc(56px + env(safe-area-inset-bottom) + 8px)',
        zIndex: 'var(--z-peek-bar)',
      }}
      aria-label={`Panier: ${itemCount} article${itemCount > 1 ? 's' : ''}, ${formatPrice(total)}`}
    >
      <div className="flex items-center gap-2">
        <ShoppingBag size={18} />
        <span className="text-sm font-semibold">
          {itemCount} article{itemCount > 1 ? 's' : ''} · {formatPrice(total)}
        </span>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium">
        <span>Panier</span>
        <ChevronRight size={16} />
      </div>
    </button>
  );
};
```

**Key details:**
- `bottom` positioned above BottomTabBar (56px + safe-area + 8px gap)
- `--z-peek-bar: 10` — below topbar, above content
- Bounce animation on `itemCount` change via scale transform
- Hidden when cart is empty (`itemCount === 0`)
- Full-width button for easy tap target

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. MiniCartBar is not imported yet — that happens in Task 5.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/MiniCartBar.tsx
git commit -m "feat: add MiniCartBar component for mobile POS"
```

---

### Task 3: Create CartBottomSheet component

**Files:**
- Create: `modules/pos/components/CartBottomSheet.tsx`

- [ ] **Step 1: Create CartBottomSheet.tsx**

Create `modules/pos/components/CartBottomSheet.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShoppingBag, Minus, Plus, Trash2, Edit3, Tag, CreditCard, User } from 'lucide-react';
import { CartItem, Client } from '../../../types';
import { formatPrice } from '../../../lib/format';

interface CartBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  clients: Client[];
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onEditItem: (item: CartItem) => void;
  totals: { subtotal: number; tax: number; total: number; vatRate: number };
  onCheckout: () => void;
}

export const CartBottomSheet: React.FC<CartBottomSheetProps> = ({
  isOpen,
  onClose,
  cart,
  clients,
  selectedClient,
  onSelectClient,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  totals,
  onCheckout,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Focus trap + Escape key
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const filteredClients = clients.filter(c =>
    c.firstName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.lastName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  const handleClientSelect = (client: Client) => {
    onSelectClient(client);
    setClientSearchOpen(false);
    setClientSearch('');
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Panier"
      className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Header with drag handle */}
      <div className="shrink-0">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-900">Panier</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer le panier"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Client selector */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        {selectedClient ? (
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              {selectedClient.photoUrl ? (
                <img src={selectedClient.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                  {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                </div>
              )}
              <div>
                <div className="font-bold text-slate-900 text-sm">{selectedClient.firstName} {selectedClient.lastName}</div>
                <div className="text-xs text-slate-500">{selectedClient.phone}</div>
              </div>
            </div>
            <button onClick={() => onSelectClient(null)} className="p-2 text-slate-400 hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setClientSearchOpen(true)}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 font-medium text-sm min-h-[44px]"
          >
            <User size={18} />
            Ajouter un Client
          </button>
        )}
      </div>

      {/* Client search overlay (fullscreen within sheet) */}
      {clientSearchOpen && (
        <div className="absolute inset-0 bg-white flex flex-col" style={{ zIndex: 1 }}>
          <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
            <span className="font-semibold text-slate-900">Sélectionner un client</span>
            <button
              onClick={() => { setClientSearchOpen(false); setClientSearch(''); }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-3 border-b border-slate-100 shrink-0">
            <input
              autoFocus
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white placeholder:text-slate-400 min-h-[44px]"
              placeholder="Chercher par nom ou téléphone..."
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {filteredClients.map(client => (
              <button
                key={client.id}
                onClick={() => handleClientSelect(client)}
                className="w-full text-left px-4 py-4 rounded-xl hover:bg-slate-50 active:bg-slate-100 flex items-center gap-3 mb-1 min-h-[52px]"
              >
                {client.photoUrl ? (
                  <img src={client.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                    {client.firstName[0]}{client.lastName[0]}
                  </div>
                )}
                <div>
                  <div className="font-medium text-sm text-slate-900">{client.firstName} {client.lastName}</div>
                  <div className="text-xs text-slate-500">{client.phone}</div>
                </div>
              </button>
            ))}
            {filteredClients.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-sm">Aucun client trouvé.</div>
            )}
          </div>
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-60">
            <ShoppingBag size={48} strokeWidth={1} />
            <p className="text-sm font-medium">Le panier est vide</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  className="w-full text-left"
                  aria-label={`Modifier ${item.name}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
                      {item.variantName && (
                        <span className="text-[10px] text-slate-500 uppercase font-bold bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-1">
                          {item.variantName}
                        </span>
                      )}
                      {item.note && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 italic">
                          <Tag size={10} /> {item.note}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm">{formatPrice(item.price * item.quantity)}</div>
                      {item.originalPrice && item.originalPrice > item.price && (
                        <div className="text-xs text-slate-400 line-through decoration-red-400">
                          {formatPrice(item.originalPrice * item.quantity)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Edit3 size={12} /> Modifier
                  </div>
                </button>

                {/* Quantity controls */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <button
                      onClick={() => item.quantity > 1 ? onUpdateQuantity(item.id, -1) : onRemoveItem(item.id)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-colors"
                      aria-label={item.quantity > 1 ? 'Diminuer quantité' : 'Supprimer'}
                    >
                      {item.quantity > 1 ? <Minus size={16} /> : <Trash2 size={16} className="text-red-500" />}
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-colors"
                      aria-label="Augmenter quantité"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    {formatPrice(item.price)} × {item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky footer: totals + checkout */}
      <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-200" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-slate-500 text-sm">
            <span>Sous-total</span>
            <span>{formatPrice(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-sm">
            <span>TVA ({totals.vatRate}%)</span>
            <span>{formatPrice(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200">
            <span>Total</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
        </div>

        <button
          onClick={() => { onCheckout(); onClose(); }}
          disabled={cart.length === 0}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-sm transition-all flex items-center justify-center gap-3"
        >
          <CreditCard size={24} />
          Payer {formatPrice(totals.total)}
        </button>
      </div>
    </div>,
    document.body
  );
};
```

**Key details:**
- Fullscreen portal with slide-up animation
- Focus trap + Escape key + body scroll lock (matching MobileDrawer pattern)
- Client selector is a fullscreen overlay within the sheet (not a dropdown)
- Quantity buttons are 40×40px (above 44px min with padding)
- Items are tappable cards that open ItemEditorModal
- Sticky footer with safe-area padding for iPhone home indicator
- Checkout button closes the sheet and triggers payment modal

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. Not imported yet — that happens in Task 5.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/CartBottomSheet.tsx
git commit -m "feat: add CartBottomSheet fullscreen component for mobile POS"
```

---

### Task 4: Make POSCatalog mobile-responsive

**Files:**
- Modify: `modules/pos/components/POSCatalog.tsx`

- [ ] **Step 1: Add useMediaQuery import and category pills improvements**

In `modules/pos/components/POSCatalog.tsx`, add the import at the top (after the existing imports):

```typescript
import { useMediaQuery } from '../../../context/MediaQueryContext';
```

Inside the component function, add:

```typescript
  const { isMobile } = useMediaQuery();
```

- [ ] **Step 2: Update category pills with scroll-snap and auto-hide on mobile search**

Replace the categories section (lines 77-95) with:

```tsx
        {/* Categories */}
        {viewMode !== 'HISTORY' && !(isMobile && searchTerm.length > 0) && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
          >
             <button
               onClick={() => setSelectedCategory('ALL')}
               className={`px-4 ${isMobile ? 'py-2' : 'py-1.5'} rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${selectedCategory === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
               style={{ scrollSnapAlign: 'start' }}
             >
               Tout
             </button>
             {(viewMode === 'SERVICES' ? serviceCategories : productCategories).map(cat => (
               <button
                 key={cat.id}
                 onClick={() => setSelectedCategory(cat.id)}
                 className={`px-4 ${isMobile ? 'py-2' : 'py-1.5'} rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${selectedCategory === cat.id ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 style={{ scrollSnapAlign: 'start' }}
               >
                 {cat.name}
               </button>
             ))}
          </div>
        )}
```

**What changed:**
- Added `!(isMobile && searchTerm.length > 0)` to hide pills when searching on mobile
- Added `scrollSnapType: 'x mandatory'` on container, `scrollSnapAlign: 'start'` on each pill
- Conditional `py-2` (mobile) vs `py-1.5` (desktop) for larger touch targets
- Added `shrink-0` to prevent pills from squishing

- [ ] **Step 3: Update view toggle buttons for 44px touch targets**

In the view toggle section (lines 51-73), update each button to have minimum touch targets on mobile. Add `min-h-[44px]` to each toggle button class:

Replace the three toggle buttons' common classes. Each button currently has `px-4 py-2`. Change to `px-4 py-2 min-h-[44px]`:

For the Services button (line 54):
```tsx
                className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
```

For the Products button (line 61):
```tsx
                className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'PRODUCTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
```

For the History button (line 68):
```tsx
                className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
```

- [ ] **Step 4: Add mobile card layout for transaction history**

Replace the history view section (lines 156-215) with a responsive version. The desktop table stays; mobile gets cards:

```tsx
        {/* History View */}
        {viewMode === 'HISTORY' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-sm">Transactions du jour</h3>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{new Date().toLocaleDateString()}</span>
             </div>

             {transactions.length === 0 ? (
               <div className="p-12 text-center text-slate-400">
                  <History size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Aucune transaction enregistrée.</p>
               </div>
             ) : isMobile ? (
               /* Mobile: card layout */
               <div className="p-3 space-y-3">
                 {transactions.map((trx) => (
                   <button
                     key={trx.id}
                     type="button"
                     onClick={() => onReceiptClick(trx)}
                     className="w-full text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus:outline-none"
                     aria-label={`Transaction ${trx.clientName || 'Client de passage'}, ${formatPrice(trx.total)}`}
                   >
                     <div className="flex justify-between items-start mb-2">
                       <div>
                         <div className="font-semibold text-slate-900 text-sm">
                           {trx.clientName || <span className="text-slate-400 italic">Client de passage</span>}
                         </div>
                         <div className="text-xs text-slate-500 mt-0.5">
                           {new Date(trx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </div>
                       </div>
                       <span className="font-bold text-slate-900">{formatPrice(trx.total)}</span>
                     </div>
                     <div className="text-xs text-slate-500 truncate">
                       {trx.items.length} article{trx.items.length > 1 ? 's' : ''} · {trx.items.map(i => i.name).join(', ')}
                     </div>
                   </button>
                 ))}
               </div>
             ) : (
               /* Desktop: table layout */
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Heure</th>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Détails</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-50/80 transition-colors">
                         <td className="px-6 py-4 font-medium text-slate-700">
                           {new Date(trx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </td>
                         <td className="px-6 py-4">
                           {trx.clientName ? (
                             <span className="text-slate-900 font-medium text-sm">{trx.clientName}</span>
                           ) : (
                             <span className="text-slate-400 italic text-sm">Client de passage</span>
                           )}
                         </td>
                         <td className="px-6 py-4">
                            <div className="text-sm text-slate-600 max-w-xs truncate">
                              {trx.items.map(i => i.name).join(', ')}
                            </div>
                         </td>
                         <td className="px-6 py-4 text-right font-bold text-slate-900">
                           {formatPrice(trx.total)}
                         </td>
                         <td className="px-6 py-4 text-right">
                           <button
                              onClick={() => onReceiptClick(trx)}
                              className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                              title="Imprimer ticket"
                           >
                             <Receipt size={16} />
                           </button>
                         </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             )}
          </div>
        )}
```

- [ ] **Step 5: Add bottom padding on mobile for MiniCartBar clearance**

The catalog content area needs padding at the bottom on mobile to avoid the MiniCartBar overlapping the last grid item. Update the content area div (line 99):

```tsx
      <div className={`flex-1 overflow-y-auto p-6 bg-slate-50 ${isMobile ? 'pb-24' : ''}`}>
```

The `pb-24` (96px) gives enough clearance for the 44px mini cart bar + safe area + gap.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add modules/pos/components/POSCatalog.tsx
git commit -m "feat: POSCatalog mobile improvements — snap pills, history cards, auto-hide filters"
```

---

### Task 5: Wire up POSModule with conditional mobile/desktop layout

**Files:**
- Modify: `modules/pos/POSModule.tsx`

- [ ] **Step 1: Add imports and useMediaQuery**

In `modules/pos/POSModule.tsx`, add to the imports section:

```typescript
import { useMediaQuery } from '../../context/MediaQueryContext';
import { MiniCartBar } from './components/MiniCartBar';
import { CartBottomSheet } from './components/CartBottomSheet';
```

Inside the component, add after the `usePOS()` call:

```typescript
  const { isMobile } = useMediaQuery();
  const [isCartOpen, setIsCartOpen] = useState(false);
```

- [ ] **Step 2: Update the JSX to conditionally render mobile/desktop layout**

Replace the entire return JSX (lines 77-141) with:

```tsx
  return (
    <div className={`flex w-full bg-slate-100 overflow-hidden ${isMobile ? 'flex-col h-full' : 'h-[calc(100vh-6rem)] rounded-xl border border-slate-200 shadow-sm'}`}>

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
      />

      {/* Desktop: sidebar cart */}
      {!isMobile && (
        <POSCart
          cart={cart}
          clients={clients}
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onEditItem={setEditingItem}
          totals={totals}
          onCheckout={() => setShowPaymentModal(true)}
        />
      )}

      {/* Mobile: mini cart bar + bottom sheet */}
      {isMobile && (
        <>
          <MiniCartBar
            itemCount={cart.length}
            total={totals.total}
            onOpen={() => setIsCartOpen(true)}
          />
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
            totals={totals}
            onCheckout={() => setShowPaymentModal(true)}
          />
        </>
      )}

      {/* Modals (shared between mobile and desktop) */}
      {showPaymentModal && (
        <PaymentModal
          total={totals.total}
          cart={cart}
          onClose={() => setShowPaymentModal(false)}
          onComplete={handleCompletePayment}
        />
      )}

      {editingItem && (
        <ItemEditorModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updated) => updateCartItem(updated.id, updated)}
        />
      )}

      {variantModalData && (
        <ServiceVariantModal
          service={variantModalData.service}
          onClose={() => setVariantModalData(null)}
          onSelect={(variant) => addVariantToCart(variant, variantModalData.service.name)}
        />
      )}

      {receiptTransaction && (
        <ReceiptModal
          transaction={receiptTransaction}
          onClose={() => setReceiptTransaction(null)}
        />
      )}
    </div>
  );
```

**Key changes:**
- Container becomes `flex-col h-full` on mobile (no border/shadow — the POS takes the full page)
- POSCart only renders on desktop
- MiniCartBar + CartBottomSheet render on mobile
- Editing an item from the cart sheet closes the sheet first, then opens the editor
- PaymentModal now receives `cart` prop (needed for collapsible summary in Task 6)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: May have a TypeScript error because PaymentModal doesn't accept `cart` prop yet — that's fine, we'll fix it in Task 6. If it blocks the build, temporarily remove the `cart={cart}` prop and add it back in Task 6.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/POSModule.tsx
git commit -m "feat: POSModule conditional mobile/desktop layout with MiniCartBar and CartBottomSheet"
```

---

### Task 6: Make PaymentModal fullscreen on mobile

**Files:**
- Modify: `modules/pos/components/PaymentModal.tsx`

- [ ] **Step 1: Add imports and mobile detection**

In `modules/pos/components/PaymentModal.tsx`, add to imports:

```typescript
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { CartItem } from '../../../types';
import { ChevronDown } from 'lucide-react';
```

Update the interface to accept cart items:

```typescript
interface PaymentModalProps {
  total: number;
  cart?: CartItem[];
  onClose: () => void;
  onComplete: (payments: PaymentEntry[]) => void;
}
```

Inside the component, add after the existing state declarations:

```typescript
  const { isMobile } = useMediaQuery();
  const [summaryExpanded, setSummaryExpanded] = useState(false);
```

Update the destructured props to include `cart`:

```typescript
export const PaymentModal: React.FC<PaymentModalProps> = ({ total, cart = [], onClose, onComplete }) => {
```

- [ ] **Step 2: Add body scroll lock and focus trap for mobile**

Add after the existing `useEffect` (line 27-33):

```typescript
  // Body scroll lock on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isMobile]);
```

- [ ] **Step 3: Add `inputMode="decimal"` to amount input**

In the amount input (around line 139-148), add `inputMode="decimal"`:

```tsx
               <input
                 type="number"
                 inputMode="decimal"
                 value={currentAmount}
                 onChange={e => setCurrentAmount(e.target.value)}
```

- [ ] **Step 4: Create mobile layout variant**

Replace the entire return JSX. The strategy: render mobile fullscreen via portal, desktop unchanged.

```tsx
  // Mobile collapsible summary
  const mobileSummary = cart.length > 0 && isMobile ? (
    <div className="border-b border-slate-100">
      <button
        type="button"
        onClick={() => setSummaryExpanded(!summaryExpanded)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm"
      >
        <span className="text-slate-600">
          {cart.length} article{cart.length > 1 ? 's' : ''} · {formatPrice(total)}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`} />
      </button>
      {summaryExpanded && (
        <div className="px-5 pb-3 space-y-2">
          {cart.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs text-slate-600">
              <span>{item.name} {item.variantName ? `(${item.variantName})` : ''} × {item.quantity}</span>
              <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Encaissement"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Encaissement</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {mobileSummary}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-2">Montant à encaisser</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={currentAmount}
                onChange={e => setCurrentAmount(e.target.value)}
                className="w-full text-4xl font-bold text-slate-800 bg-transparent border-b-2 border-slate-200 focus:border-slate-900 outline-none py-2 placeholder:text-slate-300 transition-colors"
                placeholder="0.00"
                autoFocus
              />
              <span className="absolute right-0 bottom-3 text-xl text-slate-400 font-medium">{currencySymbol}</span>
            </div>
          </div>

          {/* Payment methods 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { method: 'Carte Bancaire', Icon: CreditCard },
              { method: 'Espèces', Icon: Banknote },
              { method: 'Carte Cadeau', Icon: Gift },
              { method: 'Autre', Icon: Tag },
            ].map(({ method, Icon }) => (
              <button
                key={method}
                onClick={() => handleAddPayment(method)}
                disabled={remaining <= 0}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-h-[80px]"
              >
                <Icon size={28} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-sm text-slate-700 group-hover:text-slate-900">{method}</span>
              </button>
            ))}
          </div>

          {/* Added payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Paiements reçus</h4>
              {payments.map(p => {
                const Icon = getIcon(p.method);
                return (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white text-slate-500 flex items-center justify-center border border-slate-200">
                        <Icon size={16} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{p.method}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700">{formatPrice(p.amount)}</span>
                      <button onClick={() => removePayment(p.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-5 py-4 bg-slate-50 border-t border-slate-200 space-y-3" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Reste à payer</span>
            <span className={`font-bold ${remaining > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
              {formatPrice(remaining)}
            </span>
          </div>
          {change > 0 && (
            <div className="flex justify-between bg-emerald-50 p-2 rounded-lg text-emerald-700 text-sm font-bold">
              <span>A rendre</span>
              <span>{formatPrice(change)}</span>
            </div>
          )}
          <button
            onClick={handleFinalize}
            disabled={!isComplete}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-sm ${
              isComplete
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}
          >
            {isComplete ? (
              <><CheckCircle size={24} /> Valider la transaction</>
            ) : (
              <span>Reste {formatPrice(remaining)} à payer</span>
            )}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Desktop: existing layout (unchanged)
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* ... keep entire existing desktop JSX from line 68-213 unchanged ... */}
    </div>
  );
```

**Important:** Keep the entire existing desktop return JSX intact after the mobile `if` block. The mobile path returns early via portal; the desktop path is the fallback.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add modules/pos/components/PaymentModal.tsx modules/pos/POSModule.tsx
git commit -m "feat: PaymentModal fullscreen on mobile with collapsible summary and inputMode decimal"
```

---

### Task 7: Make ItemEditorModal fullscreen on mobile

**Files:**
- Modify: `modules/pos/components/POSModals.tsx`

- [ ] **Step 1: Add imports**

At the top of `modules/pos/components/POSModals.tsx`, add:

```typescript
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../../context/MediaQueryContext';
```

- [ ] **Step 2: Update ItemEditorModal with mobile fullscreen**

Inside the `ItemEditorModal` component, add after existing state declarations:

```typescript
  const { isMobile } = useMediaQuery();
```

Add `inputMode="decimal"` to the price input (line 57):

```tsx
              <input
                type="number"
                inputMode="decimal"
                value={price}
```

Replace the return statement. Add a mobile-first path that returns via portal, with the desktop path as fallback:

```tsx
  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Modifier ${item.name}`}
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">{item.name}</h3>
            {item.variantName && <span className="text-xs text-slate-500">{item.variantName}</span>}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Prix Unitaire</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                className="w-full text-3xl font-bold text-slate-900 border-b-2 border-slate-200 focus:border-slate-900 outline-none py-1 bg-white"
              />
              <span className="absolute right-0 bottom-2 text-lg text-slate-400">{currencySymbol}</span>
              {originalPrice !== price && (
                <span className="absolute right-8 top-2 text-sm text-slate-400 line-through">
                  {formatPrice(originalPrice)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => applyDiscount(10)} className="py-3 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 min-h-[44px]">-10%</button>
            <button onClick={() => applyDiscount(20)} className="py-3 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 min-h-[44px]">-20%</button>
            <button onClick={() => setPrice(0)} className="py-3 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-emerald-600 min-h-[44px]">Offert</button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-700">Quantité</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 text-lg font-bold">-</button>
              <span className="font-bold text-lg w-8 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 text-lg font-bold">+</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Geste commercial..."
              className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-slate-400 placeholder:text-slate-400 min-h-[44px]"
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-5 py-4 bg-slate-50 border-t border-slate-200" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <button onClick={handleSave} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-slate-800">
            Appliquer
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Desktop: existing centered modal (keep unchanged)
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* ... keep existing desktop JSX unchanged ... */}
    </div>
  );
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/pos/components/POSModals.tsx
git commit -m "feat: ItemEditorModal fullscreen on mobile with 48px touch targets and inputMode decimal"
```

---

### Task 8: Make ServiceVariantModal fullscreen on mobile

**Files:**
- Modify: `modules/pos/components/POSModals.tsx`

- [ ] **Step 1: Update ServiceVariantModal**

Inside the `ServiceVariantModal` component, add after the destructured props:

```typescript
  const { isMobile } = useMediaQuery();
```

Add a mobile-first return path before the existing desktop return:

```tsx
  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une option"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">Choisir une option</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {service.variants.map(variant => (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[56px] shadow-sm"
            >
              <div className="text-left">
                <div className="font-semibold text-slate-900">{variant.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={12} /> {variant.durationMinutes} min
                </div>
              </div>
              <div className="font-bold text-slate-900 text-lg">
                {formatPrice(variant.price)}
              </div>
            </button>
          ))}
        </div>
      </div>,
      document.body
    );
  }

  // Desktop: existing centered modal (keep unchanged)
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      {/* ... keep existing desktop JSX unchanged ... */}
    </div>
  );
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/POSModals.tsx
git commit -m "feat: ServiceVariantModal fullscreen on mobile with 56px touch targets"
```

---

### Task 9: Make ReceiptModal fullscreen on mobile

**Files:**
- Modify: `modules/pos/components/POSModals.tsx`

- [ ] **Step 1: Update ReceiptModal**

Inside the `ReceiptModal` component, add after existing state/hook declarations:

```typescript
  const { isMobile } = useMediaQuery();
```

Add a mobile-first return path:

```tsx
  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ticket de caisse"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">Ticket de caisse</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-lg text-center">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-xl mx-auto mb-3">
              {salonSettings.name.charAt(0)}
            </div>
            <h2 className="font-bold text-slate-900 text-lg">{salonSettings.name}</h2>
            <p className="text-xs text-slate-500 mt-1">{salonSettings.address}</p>
            <p className="text-xs text-slate-500">{salonSettings.phone}</p>

            <div className="mt-4 mb-6 text-xs text-slate-400">
              <div>{new Date(transaction.date).toLocaleString()}</div>
              <div className="uppercase mt-1">#{transaction.id}</div>
            </div>

            <div className="text-left space-y-4 mb-6">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                  <div>
                    <div className="font-bold text-slate-800">{item.name}</div>
                    {item.variantName && <div className="text-xs text-slate-500">{item.variantName}</div>}
                    <div className="text-xs text-slate-400">{item.quantity} x {formatPrice(item.price)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatPrice(item.price * item.quantity)}</div>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <div className="text-xs text-slate-400 line-through">{formatPrice(item.originalPrice * item.quantity)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-slate-200 pt-4 space-y-1">
              <div className="flex justify-between text-slate-500 text-xs mb-2">
                <span>TVA ({vatRate}%)</span>
                <span>{formatPrice(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900">
                <span>TOTAL</span>
                <span>{formatPrice(transaction.total)}</span>
              </div>
            </div>

            {change > 0 && (
              <div className="mt-4 flex justify-between bg-emerald-50 p-3 rounded-lg text-emerald-700 text-sm font-bold">
                <span>Monnaie rendue</span>
                <span>{formatPrice(change)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-200 bg-white flex gap-3" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <button className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm min-h-[44px]">
            <Mail size={16} /> Email
          </button>
          <button className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2 shadow-sm min-h-[44px]">
            <Printer size={16} /> Imprimer
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Desktop: existing centered modal (keep unchanged)
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* ... keep existing desktop JSX unchanged ... */}
    </div>
  );
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/POSModals.tsx
git commit -m "feat: ReceiptModal fullscreen on mobile with sticky footer"
```

---

### Task 10: Final build verification and POSCatalog border-r cleanup

**Files:**
- Modify: `modules/pos/components/POSCatalog.tsx`

- [ ] **Step 1: Remove right border on mobile**

POSCatalog has `border-r border-slate-200` which was the divider between catalog and cart sidebar. On mobile there's no sidebar, so this border should be conditional. In `modules/pos/components/POSCatalog.tsx`, update line 37:

```tsx
    <div className={`flex-1 flex flex-col h-full ${isMobile ? '' : 'border-r border-slate-200'}`}>
```

- [ ] **Step 2: Full build verification**

Run: `npm run build`
Expected: Build succeeds with no new errors. The only warnings should be the existing chunk size warning.

- [ ] **Step 3: Commit**

```bash
git add modules/pos/components/POSCatalog.tsx
git commit -m "fix: remove catalog right border on mobile, final build verification"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Fix VAT extraction formula (TTC) | usePOS.ts, POSCart.tsx, POSModals.tsx |
| 2 | Create MiniCartBar | MiniCartBar.tsx (new) |
| 3 | Create CartBottomSheet | CartBottomSheet.tsx (new) |
| 4 | POSCatalog mobile improvements | POSCatalog.tsx |
| 5 | Wire up POSModule conditional layout | POSModule.tsx |
| 6 | PaymentModal fullscreen mobile | PaymentModal.tsx |
| 7 | ItemEditorModal fullscreen mobile | POSModals.tsx |
| 8 | ServiceVariantModal fullscreen mobile | POSModals.tsx |
| 9 | ReceiptModal fullscreen mobile | POSModals.tsx |
| 10 | Final cleanup and build verification | POSCatalog.tsx |

## Deferred Items

- Loading skeleton states for catalog grid
- Pull-to-refresh on transaction history
- Barcode/QR scanning
- Split-screen tablet layout
- Print/email receipt functionality
