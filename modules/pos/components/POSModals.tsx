
import React, { useState } from 'react';
import { X, Clock, Receipt, Printer, Mail } from 'lucide-react';
import { CartItem, Service, ServiceVariant, Transaction } from '../../../types';
import { useAppContext } from '../../../context/AppContext';
import { Input } from '../../../components/FormElements';

// --- Item Editor (Discount/Price/Note) ---
export const ItemEditorModal: React.FC<{
  item: CartItem;
  onClose: () => void;
  onSave: (updatedItem: CartItem) => void;
}> = ({ item, onClose, onSave }) => {
  const { formatPrice, salonSettings } = useAppContext();
  const [price, setPrice] = useState<number>(item.price);
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [note, setNote] = useState<string>(item.note || '');
  
  const originalPrice = item.originalPrice || item.price;
  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

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
      originalPrice: originalPrice
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
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Prix Unitaire</label>
            <div className="relative">
              <input 
                type="number"
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

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => applyDiscount(10)} className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50">-10%</button>
            <button onClick={() => applyDiscount(20)} className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50">-20%</button>
            <button onClick={() => setPrice(0)} className="py-2 text-xs font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-emerald-600">Offert</button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
             <span className="text-sm font-medium text-slate-700">Quantité</span>
             <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200">-</button>
                <span className="font-bold text-lg w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200">+</button>
             </div>
          </div>

          <Input 
             label="Note"
             value={note}
             onChange={(e) => setNote(e.target.value)}
             placeholder="Ex: Geste commercial..."
          />
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
           <button onClick={handleSave} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-slate-800">
             Appliquer
           </button>
        </div>
      </div>
    </div>
  );
};

// --- Service Variant Selector ---
export const ServiceVariantModal: React.FC<{
  service: Service;
  onClose: () => void;
  onSelect: (variant: ServiceVariant) => void;
}> = ({ service, onClose, onSelect }) => {
  const { formatPrice } = useAppContext();
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
         <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Choisir une option</h3>
            <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
         </div>
         <div className="p-2">
           {service.variants.map(variant => (
             <button 
               key={variant.id}
               onClick={() => onSelect(variant)}
               className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl group transition-colors border-b border-slate-50 last:border-0"
             >
                <div className="text-left">
                   <div className="font-semibold text-slate-900">{variant.name}</div>
                   <div className="text-xs text-slate-500 flex items-center gap-1">
                     <Clock size={12} /> {variant.durationMinutes} min
                   </div>
                </div>
                <div className="font-bold text-slate-900 text-lg group-hover:scale-110 transition-transform">
                  {formatPrice(variant.price)}
                </div>
             </button>
           ))}
         </div>
      </div>
    </div>
  );
};

// --- Receipt Viewer ---
export const ReceiptModal: React.FC<{
  transaction: Transaction;
  onClose: () => void;
}> = ({ transaction, onClose }) => {
  const { salonSettings, formatPrice } = useAppContext();
  const totalPaid = transaction.payments.reduce((acc, p) => acc + p.amount, 0);
  const change = Math.max(0, totalPaid - transaction.total);
  
  // Use dynamic VAT from settings
  const vatRate = salonSettings.vatRate || 20;
  const vatAmount = transaction.total * (vatRate / 100);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">Ticket de caisse</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
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
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
           <button className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm">
              <Mail size={16} /> Email
           </button>
           <button className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2 shadow-sm">
              <Printer size={16} /> Imprimer
           </button>
        </div>
      </div>
    </div>
  );
};