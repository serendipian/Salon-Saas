
import React, { useState, useMemo } from 'react';
import { User, ShoppingBag, Trash2, Minus, Plus, Edit3, CreditCard, X, ChevronDown, Tag } from 'lucide-react';
import { CartItem, Client } from '../../../types';
import type { StaffMember } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { StaffSelector } from './StaffSelector';

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

// Extracted cart item rendering for a single item
const CartItemRow: React.FC<{
  item: CartItem;
  allStaff: StaffMember[];
  onEditItem: (item: CartItem) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateCartItem: (id: string, updates: Partial<CartItem>) => void;
}> = ({ item, allStaff, onEditItem, onUpdateQuantity, onRemoveItem, onUpdateCartItem }) => (
  <div
    key={item.id}
    onClick={() => onEditItem(item)}
    className="flex flex-col gap-2 pb-4 border-b border-slate-100 last:border-0 animate-in slide-in-from-right-4 fade-in duration-300 cursor-pointer group hover:bg-slate-50 -mx-4 px-4 pt-2 transition-colors"
  >
    <div className="flex justify-between items-start">
      <div>
        <h4 className="font-semibold text-slate-900 text-sm group-hover:text-brand-600 transition-colors">{item.name}</h4>
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
          onChange={(staffId, staffName) => onUpdateCartItem(item.id, { staffId, staffName })}
          expanded={item.type === 'SERVICE'}
        />
      </div>
      <div className="text-right">
        <div className="font-bold text-slate-900">{formatPrice(item.price * item.quantity)}</div>
        {item.originalPrice && item.originalPrice > item.price && (
          <div className="text-xs text-slate-400 line-through decoration-red-400">
            {formatPrice(item.originalPrice * item.quantity)}
          </div>
        )}
      </div>
    </div>
    <div className="flex justify-between items-center mt-1">
      <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => item.quantity > 1 ? onUpdateQuantity(item.id, -1) : onRemoveItem(item.id)}
          className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-colors shadow-sm"
        >
          {item.quantity > 1 ? <Minus size={14} /> : <Trash2 size={14} className="text-red-500" />}
        </button>
        <span className="w-8 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.id, 1)}
          className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-colors shadow-sm"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="text-xs text-slate-400 flex items-center gap-1 group-hover:text-slate-600">
        <Edit3 size={12} />
        <span>Modifier</span>
      </div>
    </div>
  </div>
);

// Cart items with pack grouping
const CartItems: React.FC<{
  cart: CartItem[];
  allStaff: StaffMember[];
  onEditItem: (item: CartItem) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateCartItem: (id: string, updates: Partial<CartItem>) => void;
}> = ({ cart, allStaff, onEditItem, onUpdateQuantity, onRemoveItem, onUpdateCartItem }) => {
  const cartWithGroups = useMemo(() => {
    const groups: Array<{ packId?: string; packName?: string; items: CartItem[] }> = [];
    const packMap = new Map<string, CartItem[]>();

    for (const item of cart) {
      if (item.packId) {
        const existing = packMap.get(item.packId) ?? [];
        existing.push(item);
        packMap.set(item.packId, existing);
      }
    }

    const seenPacks = new Set<string>();
    for (const item of cart) {
      if (item.packId) {
        if (!seenPacks.has(item.packId)) {
          seenPacks.add(item.packId);
          groups.push({
            packId: item.packId,
            packName: item.packName,
            items: packMap.get(item.packId) ?? [],
          });
        }
      } else {
        groups.push({ items: [item] });
      }
    }
    return groups;
  }, [cart]);

  if (cart.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-60">
          <ShoppingBag size={48} strokeWidth={1} />
          <p className="text-sm font-medium">Le panier est vide</p>
          <p className="text-xs text-center max-w-[200px]">Sélectionnez des services ou produits à gauche pour commencer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {cartWithGroups.map((group) => (
        <div key={group.packId ?? group.items[0]?.id}>
          {group.packId && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border-l-2 border-emerald-400 rounded-t-lg mb-1 -mx-4 mx-0">
              <span className="text-xs font-medium text-emerald-700">Pack: {group.packName}</span>
              <button
                onClick={() => group.items.forEach((item) => onRemoveItem(item.id))}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                Supprimer le pack
              </button>
            </div>
          )}
          {group.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              allStaff={allStaff}
              onEditItem={onEditItem}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveItem={onRemoveItem}
              onUpdateCartItem={onUpdateCartItem}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const POSCart: React.FC<POSCartProps> = ({
  cart,
  clients,
  selectedClient,
  onSelectClient,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  onUpdateCartItem,
  allStaff,
  totals,
  onCheckout
}) => {
  const [isClientSelectorOpen, setIsClientSelectorOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const filteredClients = clients.filter(c => 
    c.firstName.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.lastName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  return (
    <div className="w-96 bg-white flex flex-col shadow-xl z-20 border-l border-slate-200 h-full">
       
       {/* Client Section */}
       <div className="p-4 border-b border-slate-100 relative bg-white">
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
                    <div className="text-xs text-slate-500">Client Fidèle</div>
                 </div>
              </div>
              <button onClick={() => onSelectClient(null)} className="text-slate-400 hover:text-red-500 p-1">
                <X size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsClientSelectorOpen(!isClientSelectorOpen)}
              className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 font-medium text-sm"
            >
              <User size={18} />
              Ajouter un Client
            </button>
          )}

          {/* Client Selector Dropdown */}
          {isClientSelectorOpen && !selectedClient && (
            <div className="absolute top-full left-0 w-full bg-white shadow-xl border-b border-x border-slate-200 rounded-b-xl z-50 max-h-64 overflow-y-auto">
               <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                 <input 
                    autoFocus 
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-slate-400 placeholder:text-slate-400" 
                    placeholder="Chercher client..." 
                  />
               </div>
               {filteredClients.map(client => (
                 <button 
                  key={client.id}
                  onClick={() => { onSelectClient(client); setIsClientSelectorOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group"
                 >
                   <div className="flex items-center gap-3">
                     {client.photoUrl ? (
                        <img src={client.photoUrl} className="w-8 h-8 rounded-full object-cover" />
                     ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {client.firstName[0]}{client.lastName[0]}
                        </div>
                     )}
                     <div>
                       <div className="font-medium text-sm text-slate-900">{client.firstName} {client.lastName}</div>
                       <div className="text-xs text-slate-500">{client.phone}</div>
                     </div>
                   </div>
                   <ChevronDown className="opacity-0 group-hover:opacity-100 -rotate-90 text-slate-300" size={16} />
                 </button>
               ))}
            </div>
          )}
       </div>

       {/* Cart Items */}
       <CartItems
         cart={cart}
         allStaff={allStaff}
         onEditItem={onEditItem}
         onUpdateQuantity={onUpdateQuantity}
         onRemoveItem={onRemoveItem}
         onUpdateCartItem={onUpdateCartItem}
       />


       {/* Totals & Action */}
       <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="space-y-2 mb-6">
             <div className="flex justify-between text-slate-500 text-sm">
               <span>Sous-total</span>
               <span>{formatPrice(totals.subtotal)}</span>
             </div>
             <div className="flex justify-between text-slate-500 text-sm">
               <span>TVA ({totals.vatRate}%)</span>
               <span>{formatPrice(totals.tax)}</span>
             </div>
             <div className="flex justify-between text-slate-900 font-bold text-xl pt-2 border-t border-slate-200">
               <span>Total</span>
               <span>{formatPrice(totals.total)}</span>
             </div>
          </div>

          <button 
            onClick={onCheckout}
            disabled={cart.length === 0}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-sm transition-all flex items-center justify-center gap-3"
          >
            <CreditCard size={24} />
            Encaissement
          </button>
       </div>
    </div>
  );
};
