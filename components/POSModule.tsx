
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  User, 
  Plus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Gift, 
  X, 
  CheckCircle, 
  Minus, 
  ShoppingBag, 
  Scissors, 
  ChevronDown,
  Tag,
  Clock,
  History,
  Receipt,
  Edit3,
  Printer,
  Mail
} from 'lucide-react';
import { CartItem, Client, Product, Service, ServiceVariant, Transaction, PaymentEntry } from '../types';
import { useAppContext } from '../context/AppContext';

type POSViewMode = 'SERVICES' | 'PRODUCTS' | 'HISTORY';

// --- Item Editor Modal (Price & Discount) ---
const ItemEditorModal: React.FC<{
  item: CartItem;
  onClose: () => void;
  onSave: (updatedItem: CartItem) => void;
}> = ({ item, onClose, onSave }) => {
  // Initialize with current item values
  const [price, setPrice] = useState<number>(item.price);
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [note, setNote] = useState<string>(item.note || '');
  
  const originalPrice = item.originalPrice || item.price;

  const applyDiscount = (percent: number) => {
    const newPrice = originalPrice * (1 - percent / 100);
    setPrice(parseFloat(newPrice.toFixed(2)));
  };

  const handleSave = () => {
    onSave({
      ...item,
      price,
      quantity,
      note,
      originalPrice: originalPrice // Ensure we keep the reference
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
             <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
             {item.variantName && <span className="text-xs text-slate-500">{item.variantName}</span>}
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-700" /></button>
        </div>
        
        <div className="p-5 space-y-6">
          {/* Price Override */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Prix Unitaire (€)</label>
            <div className="relative">
              <input 
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                className="w-full text-3xl font-bold text-slate-900 border-b-2 border-slate-200 focus:border-slate-900 outline-none py-1 bg-white"
              />
              {originalPrice !== price && (
                <span className="absolute right-0 top-2 text-sm text-slate-400 line-through">
                  {originalPrice.toFixed(2)} €
                </span>
              )}
            </div>
          </div>

          {/* Quick Discount Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => applyDiscount(10)} 
              className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
            >
              -10%
            </button>
            <button 
              onClick={() => applyDiscount(20)} 
              className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
            >
              -20%
            </button>
            <button 
              onClick={() => setPrice(0)} 
              className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors text-emerald-600 shadow-sm"
            >
              Offert
            </button>
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
             <span className="text-sm font-medium text-slate-700">Quantité</span>
             <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200">-</button>
                <span className="font-bold text-lg w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200">+</button>
             </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Raison de la modification</label>
            <input 
               type="text"
               value={note}
               onChange={(e) => setNote(e.target.value)}
               placeholder="Ex: Geste commercial, Ami..."
               className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
           <button onClick={handleSave} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-slate-800 transition-colors">
             Appliquer
           </button>
        </div>
      </div>
    </div>
  );
};

// --- Receipt Viewer Modal ---
const ReceiptModal: React.FC<{
  transaction: Transaction;
  onClose: () => void;
}> = ({ transaction, onClose }) => {
  const totalPaid = transaction.payments.reduce((acc, p) => acc + p.amount, 0);
  const change = Math.max(0, totalPaid - transaction.total);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">Ticket de caisse</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        {/* Receipt Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-lg">
             
             {/* Header Info */}
             <div className="text-center border-b-2 border-dashed border-slate-200 pb-6 mb-6">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-xl mx-auto mb-3">L</div>
                <h2 className="font-bold text-slate-900 text-lg">Lumière Beauty</h2>
                <p className="text-xs text-slate-500 mt-1">12 Avenue des Champs-Élysées, Paris</p>
                <p className="text-xs text-slate-500">01 23 45 67 89</p>
                
                <div className="mt-4 text-xs text-slate-400 flex justify-center gap-3">
                  <span>{new Date(transaction.date).toLocaleDateString()}</span>
                  <span>{new Date(transaction.date).toLocaleTimeString()}</span>
                </div>
                <div className="text-[10px] text-slate-300 mt-1 uppercase">#{transaction.id}</div>
             </div>

             {/* Line Items */}
             <div className="space-y-4 mb-6">
               {transaction.items.map((item, idx) => {
                 const isDiscounted = item.originalPrice && item.originalPrice > item.price;
                 
                 return (
                   <div key={idx} className="flex flex-col border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start">
                         <div className="flex-1">
                            <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                            {item.variantName && <div className="text-xs text-slate-500">{item.variantName}</div>}
                            <div className="text-xs text-slate-400 mt-0.5">
                               {item.quantity} x {item.price.toFixed(2)} €
                            </div>
                            {item.note && (
                              <div className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 inline-block px-1 rounded">
                                Note: {item.note}
                              </div>
                            )}
                         </div>
                         <div className="text-right">
                            <div className="font-bold text-slate-900 text-sm">
                              {(item.price * item.quantity).toFixed(2)} €
                            </div>
                            {isDiscounted && (
                              <div className="text-xs text-slate-400 line-through decoration-red-300">
                                {(item.originalPrice! * item.quantity).toFixed(2)} €
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                 );
               })}
             </div>

             {/* Totals */}
             <div className="border-t-2 border-dashed border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                   <span>Sous-total</span>
                   <span>{transaction.total.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                   <span>TVA (20%)</span>
                   <span>{(transaction.total * 0.2).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100 mt-2">
                   <span>TOTAL</span>
                   <span>{transaction.total.toFixed(2)} €</span>
                </div>
             </div>

             {/* Payments */}
             <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 rounded-lg p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Paiements</div>
                {transaction.payments.map((p, i) => (
                   <div key={i} className="flex justify-between text-xs text-slate-600 mb-1 last:mb-0">
                      <span>{p.method}</span>
                      <span className="font-medium">{p.amount.toFixed(2)} €</span>
                   </div>
                ))}
                {change > 0 && (
                  <div className="flex justify-between text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200/50">
                      <span className="font-bold">Rendu monnaie</span>
                      <span className="font-bold">{change.toFixed(2)} €</span>
                   </div>
                )}
             </div>
             
             {transaction.clientName && (
                <div className="mt-4 text-center">
                  <span className="text-xs text-slate-400">Client: {transaction.clientName}</span>
                </div>
             )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
           <button className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors shadow-sm">
              <Mail size={16} /> Email
           </button>
           <button className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors shadow-sm">
              <Printer size={16} /> Imprimer
           </button>
        </div>

      </div>
    </div>
  );
};

// --- Payment Modal Sub-Component ---
const PaymentModal: React.FC<{
  total: number;
  onClose: () => void;
  onComplete: (payments: PaymentEntry[]) => void;
}> = ({ total, onClose, onComplete }) => {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentAmount, setCurrentAmount] = useState<string>(total.toFixed(2));
  
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);
  const isComplete = remaining === 0;

  // Update input to match remaining when payments change, unless complete
  useEffect(() => {
    if (!isComplete) {
      setCurrentAmount(remaining.toFixed(2));
    } else {
      setCurrentAmount('');
    }
  }, [totalPaid, isComplete, total]);

  const handleAddPayment = (method: string, Icon: any) => {
    const amount = parseFloat(currentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newPayment: PaymentEntry = {
      id: `pay-${Date.now()}`,
      method,
      amount,
    };

    setPayments([...payments, newPayment]);
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleFinalize = () => {
    if (isComplete) {
      onComplete(payments);
    }
  };

  // Helper to get icon component (display only)
  const getIcon = (method: string) => {
    if (method.includes('Carte Bancaire')) return CreditCard;
    if (method.includes('Espèces')) return Banknote;
    if (method.includes('Cadeau')) return Gift;
    return Tag;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row h-[600px]">
        
        {/* Left: Summary & Payments List */}
        <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
          <div className="mb-6">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total à payer</h3>
             <div className="text-4xl font-bold text-slate-900 mb-4">{total.toFixed(2)} €</div>
             
             <div className="space-y-2 text-sm">
               <div className="flex justify-between text-slate-600">
                 <span>Déjà payé</span>
                 <span className="font-medium text-emerald-700">{totalPaid.toFixed(2)} €</span>
               </div>
               <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                 <span>Reste à payer</span>
                 <span className={`font-bold text-lg ${remaining > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                   {remaining.toFixed(2)} €
                 </span>
               </div>
               {change > 0 && (
                 <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200 bg-emerald-50 p-2 rounded-lg mt-2">
                   <span className="font-bold text-emerald-700">A rendre</span>
                   <span className="font-bold text-emerald-700">{change.toFixed(2)} €</span>
                 </div>
               )}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Paiements reçus</h4>
            {payments.length === 0 && (
              <p className="text-sm text-slate-400 italic">Aucun paiement enregistré.</p>
            )}
            {payments.map(p => {
              const Icon = getIcon(p.method);
              return (
                <div key={p.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-left-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700">{p.method}</div>
                      <div className="text-xs text-slate-500">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700">{p.amount.toFixed(2)} €</span>
                    <button onClick={() => removePayment(p.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Input & Actions */}
        <div className="flex-1 p-8 flex flex-col bg-white">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Encaissement</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Amount Input */}
          <div className="mb-8">
             <label className="block text-sm font-medium text-slate-500 mb-2">Montant à encaisser</label>
             <div className="relative">
               <input 
                 type="number"
                 value={currentAmount}
                 onChange={e => setCurrentAmount(e.target.value)}
                 className="w-full text-5xl font-bold text-slate-800 bg-transparent border-b-2 border-slate-200 focus:border-slate-900 outline-none py-2 placeholder:text-slate-300 transition-colors"
                 placeholder="0.00"
                 autoFocus
               />
               <span className="absolute right-0 bottom-4 text-2xl text-slate-400 font-medium">€</span>
             </div>
          </div>

          {/* Payment Methods Grid */}
          <div className="grid grid-cols-2 gap-4 mb-auto">
             <button 
               onClick={() => handleAddPayment('Carte Bancaire', CreditCard)}
               disabled={remaining <= 0}
               className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <CreditCard size={32} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-slate-700 group-hover:text-slate-900">Carte Bancaire</span>
             </button>

             <button 
               onClick={() => handleAddPayment('Espèces', Banknote)}
               disabled={remaining <= 0}
               className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <Banknote size={32} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-slate-700 group-hover:text-slate-900">Espèces</span>
             </button>

             <button 
               onClick={() => handleAddPayment('Carte Cadeau', Gift)}
               disabled={remaining <= 0}
               className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <Gift size={32} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-slate-700 group-hover:text-slate-900">Carte Cadeau</span>
             </button>

              <button 
               onClick={() => handleAddPayment('Autre', Tag)}
               disabled={remaining <= 0}
               className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <Tag size={32} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-slate-700 group-hover:text-slate-900">Autre</span>
             </button>
          </div>

          {/* Validation */}
          <div className="mt-6 pt-6 border-t border-slate-100">
             <button 
               onClick={handleFinalize}
               disabled={!isComplete}
               className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-sm ${
                 isComplete 
                 ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' 
                 : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
               }`}
             >
               {isComplete ? (
                 <>
                   <CheckCircle size={24} />
                   Valider la transaction
                 </>
               ) : (
                 <span>Reste {remaining.toFixed(2)} € à payer</span>
               )}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const POSModule: React.FC = () => {
  const { 
    services, 
    serviceCategories, 
    products, 
    productCategories, 
    transactions,
    clients, 
    addTransaction 
  } = useAppContext();

  const [viewMode, setViewMode] = useState<POSViewMode>('SERVICES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null); 
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientSelectorOpen, setIsClientSelectorOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [serviceVariantModal, setServiceVariantModal] = useState<{service: Service, isOpen: boolean} | null>(null);
  
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // --- Helpers ---

  const addToCart = (item: CartItem) => {
    const itemWithMeta = {
        ...item,
        originalPrice: item.price
    };

    const existingItemIndex = cart.findIndex(
      i => i.referenceId === item.referenceId && i.variantName === item.variantName
    );

    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, itemWithMeta]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };
  
  const handleCartItemUpdate = (updatedItem: CartItem) => {
    setCart(cart.map(item => item.id === updatedItem.id ? updatedItem : item));
    setEditingItem(null);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleServiceClick = (service: Service) => {
    if (service.variants.length > 1) {
      setServiceVariantModal({ service, isOpen: true });
    } else {
      const variant = service.variants[0];
      addToCart({
        id: `cart-${Date.now()}`,
        referenceId: variant.id,
        type: 'SERVICE',
        name: service.name,
        variantName: variant.name,
        price: variant.price,
        originalPrice: variant.price,
        quantity: 1
      });
    }
  };

  const handleProductClick = (product: Product) => {
    addToCart({
      id: `cart-${Date.now()}`,
      referenceId: product.id,
      type: 'PRODUCT',
      name: product.name,
      price: product.price,
      originalPrice: product.price,
      quantity: 1
    });
  };

  const handleVariantSelect = (variant: ServiceVariant, serviceName: string) => {
    addToCart({
      id: `cart-${Date.now()}`,
      referenceId: variant.id,
      type: 'SERVICE',
      name: serviceName,
      variantName: variant.name,
      price: variant.price,
      originalPrice: variant.price,
      quantity: 1
    });
    setServiceVariantModal(null);
  };

  const handleTransactionComplete = (payments: PaymentEntry[]) => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const newTransaction: Transaction = {
      id: `trx-${Date.now()}`,
      date: new Date().toISOString(),
      total: subtotal,
      clientName: selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : undefined,
      clientId: selectedClient?.id,
      items: [...cart],
      payments: payments
    };

    addTransaction(newTransaction);

    setShowPaymentModal(false);
    setCart([]);
    setSelectedClient(null);
    
    setViewMode('HISTORY');
  };

  // --- Derived State ---
  
  const filteredItems = useMemo(() => {
    if (viewMode === 'SERVICES') {
      return services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || s.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    } else if (viewMode === 'PRODUCTS') {
      return products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      });
    }
    return [];
  }, [viewMode, searchTerm, selectedCategory, services, products]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.20; // Mock 20% VAT
  const total = subtotal;

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full bg-slate-100 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      
      {/* LEFT PANEL: Catalog or History */}
      <div className="flex-1 flex flex-col border-r border-slate-200">
        {/* Top Bar: Search & Tabs */}
        <div className="bg-white p-4 shadow-sm z-10">
          <div className="flex items-center gap-4 mb-4">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={viewMode === 'HISTORY' ? "Rechercher une transaction..." : (viewMode === 'SERVICES' ? "Rechercher un service..." : "Rechercher un produit...")}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-lg placeholder:text-slate-400 shadow-sm"
                />
             </div>
             <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => { setViewMode('SERVICES'); setSelectedCategory('ALL'); }}
                  className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Scissors size={16} />
                  Services
                </button>
                <button 
                  onClick={() => { setViewMode('PRODUCTS'); setSelectedCategory('ALL'); }}
                  className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'PRODUCTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ShoppingBag size={16} />
                  Produits
                </button>
                 <button 
                  onClick={() => { setViewMode('HISTORY'); }}
                  className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <History size={16} />
                  Historique
                </button>
             </div>
          </div>

          {/* Categories (Only for Services/Products) */}
          {viewMode !== 'HISTORY' && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
               <button 
                 onClick={() => setSelectedCategory('ALL')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${selectedCategory === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
               >
                 Tout
               </button>
               {(viewMode === 'SERVICES' ? serviceCategories : productCategories).map(cat => (
                 <button
                   key={cat.id}
                   onClick={() => setSelectedCategory(cat.id)}
                   className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${selectedCategory === cat.id ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 >
                   {cat.name}
                 </button>
               ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          
          {/* MODE: CATALOG (GRID) */}
          {(viewMode === 'SERVICES' || viewMode === 'PRODUCTS') && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item: any) => {
                 // Determine visual style based on type
                 const isService = viewMode === 'SERVICES';
                 const category = isService 
                    ? serviceCategories.find(c => c.id === item.categoryId)
                    : productCategories.find(c => c.id === item.categoryId);
                 
                 // Price display logic
                 let priceDisplay = '';
                 if (isService) {
                   const prices = item.variants.map((v: any) => v.price);
                   const min = Math.min(...prices);
                   priceDisplay = `${min} €`;
                   if (prices.length > 1) priceDisplay += '+';
                 } else {
                   priceDisplay = `${item.price} €`;
                 }

                 return (
                   <button 
                     key={item.id}
                     onClick={() => isService ? handleServiceClick(item) : handleProductClick(item)}
                     className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
                   >
                     <div className={`absolute top-0 left-0 w-1 h-full ${category?.color.split(' ')[0] || 'bg-slate-200'}`} />
                     
                     <div className="flex-1">
                       <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-white text-slate-600`}>
                         {category?.name || 'General'}
                       </span>
                       <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
                         {item.name}
                       </h3>
                       {isService && item.variants.length > 1 && (
                         <span className="text-xs text-slate-400">{item.variants.length} options</span>
                       )}
                       {!isService && (
                         <span className="text-xs text-slate-400">Stock: {item.stock}</span>
                       )}
                     </div>
                     
                     <div className="mt-auto flex justify-between items-end">
                       <span className="text-lg font-bold text-slate-800">{priceDisplay}</span>
                       <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                         <Plus size={18} />
                       </div>
                     </div>
                   </button>
                 );
              })}
            </div>
          )}

          {/* MODE: HISTORY (LIST) */}
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
               ) : (
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Heure</th>
                        <th className="px-6 py-4">Client</th>
                        <th className="px-6 py-4">Détails</th>
                        <th className="px-6 py-4">Paiement</th>
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
                              <div className="text-xs text-slate-400">
                                {trx.items.reduce((acc, i) => acc + i.quantity, 0)} articles
                              </div>
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex gap-1">
                               {trx.payments.map(p => (
                                 <span key={p.id} className="text-[10px] uppercase font-bold bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-600">
                                   {p.method}
                                 </span>
                               ))}
                             </div>
                           </td>
                           <td className="px-6 py-4 text-right font-bold text-slate-900">
                             {trx.total.toFixed(2)} €
                           </td>
                           <td className="px-6 py-4 text-right">
                             <button 
                                onClick={() => setSelectedTransaction(trx)}
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

        </div>
      </div>

      {/* RIGHT PANEL: Cart */}
      <div className="w-96 bg-white flex flex-col shadow-xl z-20 border-l border-slate-200">
         
         {/* 1. Client Section */}
         <div className="p-4 border-b border-slate-100 relative bg-white">
            {selectedClient ? (
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                     {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                   </div>
                   <div>
                      <div className="font-bold text-slate-900 text-sm">{selectedClient.firstName} {selectedClient.lastName}</div>
                      <div className="text-xs text-slate-500">Client Fidèle</div>
                   </div>
                </div>
                <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-red-500 p-1">
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
                   <input autoFocus className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-slate-400 placeholder:text-slate-400" placeholder="Chercher client..." />
                 </div>
                 {clients.map(client => (
                   <button 
                    key={client.id}
                    onClick={() => { setSelectedClient(client); setIsClientSelectorOpen(false); }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group"
                   >
                     <div>
                       <div className="font-medium text-sm text-slate-900">{client.firstName} {client.lastName}</div>
                       <div className="text-xs text-slate-500">{client.phone}</div>
                     </div>
                     <ChevronDown className="opacity-0 group-hover:opacity-100 -rotate-90 text-slate-300" size={16} />
                   </button>
                 ))}
              </div>
            )}
         </div>

         {/* 2. Cart Items */}
         <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-60">
                 <ShoppingBag size={48} strokeWidth={1} />
                 <p className="text-sm font-medium">Le panier est vide</p>
                 <p className="text-xs text-center max-w-[200px]">Sélectionnez des services ou produits à gauche pour commencer.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setEditingItem(item)} // CLICK TO EDIT
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
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{(item.price * item.quantity).toFixed(2)} €</div>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <div className="text-xs text-slate-400 line-through decoration-red-400">
                             {(item.originalPrice * item.quantity).toFixed(2)} €
                          </div>
                        )}
                      </div>
                   </div>
                   
                   <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => item.quantity > 1 ? updateQuantity(item.id, -1) : removeFromCart(item.id)}
                          className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-colors shadow-sm"
                        >
                          {item.quantity > 1 ? <Minus size={14} /> : <Trash2 size={14} className="text-red-500" />}
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
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
              ))
            )}
         </div>

         {/* 3. Totals & Action */}
         <div className="p-6 bg-slate-50 border-t border-slate-200">
            <div className="space-y-2 mb-6">
               <div className="flex justify-between text-slate-500 text-sm">
                 <span>Sous-total</span>
                 <span>{subtotal.toFixed(2)} €</span>
               </div>
               <div className="flex justify-between text-slate-500 text-sm">
                 <span>TVA (20%)</span>
                 <span>{tax.toFixed(2)} €</span>
               </div>
               <div className="flex justify-between text-slate-900 font-bold text-xl pt-2 border-t border-slate-200">
                 <span>Total</span>
                 <span>{total.toFixed(2)} €</span>
               </div>
            </div>

            <button 
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-sm transition-all flex items-center justify-center gap-3"
            >
              <CreditCard size={24} />
              Encaissement
            </button>
         </div>
      </div>

      {/* --- MODALS --- */}

      {/* Item Editor Modal (Price Discount) */}
      {editingItem && (
        <ItemEditorModal 
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleCartItemUpdate}
        />
      )}

      {/* Service Variant Selector Modal */}
      {serviceVariantModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
             <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Choisir une option</h3>
                <button onClick={() => setServiceVariantModal(null)}><X size={20} className="text-slate-400" /></button>
             </div>
             <div className="p-2">
               {serviceVariantModal.service.variants.map(variant => (
                 <button 
                   key={variant.id}
                   onClick={() => handleVariantSelect(variant, serviceVariantModal.service.name)}
                   className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl group transition-colors border-b border-slate-50 last:border-0"
                 >
                    <div className="text-left">
                       <div className="font-semibold text-slate-900">{variant.name}</div>
                       <div className="text-xs text-slate-500 flex items-center gap-1">
                         <Clock size={12} /> {variant.durationMinutes} min
                       </div>
                    </div>
                    <div className="font-bold text-slate-900 text-lg group-hover:scale-110 transition-transform">
                      {variant.price} €
                    </div>
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal 
          total={total}
          onClose={() => setShowPaymentModal(false)}
          onComplete={handleTransactionComplete}
        />
      )}

      {/* Receipt Modal */}
      {selectedTransaction && (
        <ReceiptModal 
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
};
