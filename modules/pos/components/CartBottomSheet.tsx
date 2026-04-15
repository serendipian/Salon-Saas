import { CreditCard, Edit3, Minus, Plus, ShoppingBag, Tag, Trash2, User, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPrice } from '../../../lib/format';
import type { CartItem, Client, Service, StaffMember } from '../../../types';
import { resolveCartItemCategoryId } from '../utils/resolveCartItemCategoryId';
import { StaffSelector } from './StaffSelector';

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
  onUpdateCartItem: (id: string, updates: Partial<CartItem>) => void;
  allStaff: StaffMember[];
  services: Service[];
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
  onUpdateCartItem,
  allStaff,
  services,
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
      return () => {
        document.body.style.overflow = '';
      };
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
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.firstName.toLowerCase().includes(clientSearch.toLowerCase()) ||
          c.lastName.toLowerCase().includes(clientSearch.toLowerCase()) ||
          c.phone.includes(clientSearch),
      ),
    [clients, clientSearch],
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
                <img
                  src={selectedClient.photoUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                  {selectedClient.firstName[0]}
                  {selectedClient.lastName[0]}
                </div>
              )}
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedClient.firstName} {selectedClient.lastName}
                </div>
                <div className="text-xs text-slate-500">{selectedClient.phone}</div>
              </div>
            </div>
            <button
              onClick={() => onSelectClient(null)}
              className="p-2 text-slate-400 hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
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
              onClick={() => {
                setClientSearchOpen(false);
                setClientSearch('');
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-3 border-b border-slate-100 shrink-0">
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white placeholder:text-slate-400 min-h-[44px]"
              placeholder="Chercher par nom ou téléphone..."
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleClientSelect(client)}
                className="w-full text-left px-4 py-4 rounded-xl hover:bg-slate-50 active:bg-slate-100 flex items-center gap-3 mb-1 min-h-[52px]"
              >
                {client.photoUrl ? (
                  <img
                    src={client.photoUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                    {client.firstName[0]}
                    {client.lastName[0]}
                  </div>
                )}
                <div>
                  <div className="font-medium text-sm text-slate-900">
                    {client.firstName} {client.lastName}
                  </div>
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
                      <StaffSelector
                        staffId={item.staffId}
                        staffName={item.staffName}
                        staffMembers={allStaff}
                        onChange={(staffId, staffName) =>
                          onUpdateCartItem(item.id, { staffId, staffName })
                        }
                        categoryId={resolveCartItemCategoryId(item, services)}
                      />
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm">
                        {formatPrice(item.price * item.quantity)}
                      </div>
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
                      onClick={() =>
                        item.quantity > 1 ? onUpdateQuantity(item.id, -1) : onRemoveItem(item.id)
                      }
                      className="w-12 h-12 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-colors"
                      aria-label={item.quantity > 1 ? 'Diminuer quantité' : 'Supprimer'}
                    >
                      {item.quantity > 1 ? (
                        <Minus size={16} />
                      ) : (
                        <Trash2 size={16} className="text-red-500" />
                      )}
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-12 h-12 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-colors"
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
      <div
        className="shrink-0 p-4 bg-slate-50 border-t border-slate-200"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
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
          onClick={() => {
            onCheckout();
            onClose();
          }}
          disabled={cart.length === 0}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-sm transition-all flex items-center justify-center gap-3"
        >
          <CreditCard size={24} />
          Payer {formatPrice(totals.total)}
        </button>
      </div>
    </div>,
    document.body,
  );
};
