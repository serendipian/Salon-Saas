import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { BonusTier } from '../types';
import { useMediaQuery } from '../context/MediaQueryContext';

interface BonusSystemEditorProps {
  tiers: BonusTier[];
  onChange: (tiers: BonusTier[]) => void;
  currencySymbol?: string;
}

export const BonusSystemEditor: React.FC<BonusSystemEditorProps> = ({ tiers = [], onChange, currencySymbol = '€' }) => {
  const { isMobile } = useMediaQuery();

  const addTier = () => {
    onChange([...tiers, { target: 0, bonus: 0 }]);
  };

  const updateTier = (index: number, field: keyof BonusTier, value: number) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    onChange(newTiers);
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-500 leading-relaxed">
        Définissez des primes automatiques lorsque le chiffre d'affaires journalier atteint un objectif spécifique.
      </div>

      {tiers.length > 0 && !isMobile && (
        <div className="grid grid-cols-12 gap-4 mb-1 px-1">
          <div className="col-span-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
             Objectif C.A. ({currencySymbol})
          </div>
          <div className="col-span-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
             Prime ({currencySymbol})
          </div>
          <div className="col-span-2"></div>
        </div>
      )}
      
      <div className="space-y-2">
        {tiers.map((tier, idx) => (
          isMobile ? (
            /* Mobile: card layout */
            <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3 animate-in slide-in-from-left-2 duration-300">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Objectif C.A. ({currencySymbol})
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={tier.target}
                  onChange={e => updateTier(idx, 'target', parseFloat(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Prime ({currencySymbol})
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={tier.bonus}
                  onChange={e => updateTier(idx, 'bonus', parseFloat(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm font-medium min-h-[44px]"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={() => removeTier(idx)}
                className="w-full py-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-xs font-semibold border border-red-200 min-h-[44px]"
              >
                Supprimer ce palier
              </button>
            </div>
          ) : (
            /* Desktop: grid layout */
            <div key={idx} className="grid grid-cols-12 gap-4 items-center animate-in slide-in-from-left-2 duration-300 group">
              <div className="col-span-5">
                <input
                  type="number"
                  value={tier.target}
                  onChange={e => updateTier(idx, 'target', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm placeholder-slate-400"
                  placeholder="0"
                />
              </div>
              <div className="col-span-5">
                <input
                  type="number"
                  value={tier.bonus}
                  onChange={e => updateTier(idx, 'bonus', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm placeholder-slate-400 font-medium"
                  placeholder="0"
                />
              </div>
              <div className="col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-60 group-hover:opacity-100"
                  title="Supprimer ce palier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )
        ))}
      </div>

      <button 
        type="button"
        onClick={addTier}
        className="w-full py-2.5 border border-dashed border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400 hover:bg-slate-50 rounded-lg text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-2 transition-all mt-2"
      >
        <Plus size={14} />
        Ajouter un palier
      </button>
    </div>
  );
};