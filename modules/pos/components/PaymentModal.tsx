
import React, { useState, useEffect } from 'react';
import { X, Trash2, CreditCard, Banknote, Gift, Tag, CheckCircle } from 'lucide-react';
import { PaymentEntry } from '../../../types';
import { useAppContext } from '../../../context/AppContext';

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onComplete: (payments: PaymentEntry[]) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ total, onClose, onComplete }) => {
  const { formatPrice, salonSettings } = useAppContext();
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentAmount, setCurrentAmount] = useState<string>(total.toFixed(2));
  
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);
  const isComplete = remaining === 0;

  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  // Update input to match remaining when payments change, unless complete
  useEffect(() => {
    if (!isComplete) {
      setCurrentAmount(remaining.toFixed(2));
    } else {
      setCurrentAmount('');
    }
  }, [totalPaid, isComplete, total]);

  const handleAddPayment = (method: string) => {
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
             <div className="text-4xl font-bold text-slate-900 mb-4">{formatPrice(total)}</div>
             
             <div className="space-y-2 text-sm">
               <div className="flex justify-between text-slate-600">
                 <span>Déjà payé</span>
                 <span className="font-medium text-emerald-700">{formatPrice(totalPaid)}</span>
               </div>
               <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                 <span>Reste à payer</span>
                 <span className={`font-bold text-lg ${remaining > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                   {formatPrice(remaining)}
                 </span>
               </div>
               {change > 0 && (
                 <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200 bg-emerald-50 p-2 rounded-lg mt-2">
                   <span className="font-bold text-emerald-700">A rendre</span>
                   <span className="font-bold text-emerald-700">{formatPrice(change)}</span>
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
                    <span className="font-bold text-slate-700">{formatPrice(p.amount)}</span>
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
               <span className="absolute right-0 bottom-4 text-2xl text-slate-400 font-medium">{currencySymbol}</span>
             </div>
          </div>

          {/* Payment Methods Grid */}
          <div className="grid grid-cols-2 gap-4 mb-auto">
             <button 
               onClick={() => handleAddPayment('Carte Bancaire')}
               disabled={remaining <= 0}
               className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <CreditCard size={32} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-slate-700 group-hover:text-slate-900">Carte Bancaire</span>
             </button>

             <button 
               onClick={() => handleAddPayment('Espèces')}
               disabled={remaining <= 0}
               className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <Banknote size={32} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-slate-700 group-hover:text-slate-900">Espèces</span>
             </button>

             <button 
               onClick={() => handleAddPayment('Carte Cadeau')}
               disabled={remaining <= 0}
               className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                <Gift size={32} className="text-slate-400 group-hover:text-slate-900" />
                <span className="font-bold text-slate-700 group-hover:text-slate-900">Carte Cadeau</span>
             </button>

              <button 
               onClick={() => handleAddPayment('Autre')}
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
                 <span>Reste {formatPrice(remaining)} à payer</span>
               )}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
