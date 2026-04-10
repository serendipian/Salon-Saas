
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Users, ArrowLeft, Trash2, Info } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { Input } from '../../../components/FormElements';

export const AccountingSettings: React.FC = () => {
  const navigate = useNavigate();
  const {
    expenseCategories,
    updateExpenseCategories,
    salonSettings,
    updateSalonSettings,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<'TAXES' | 'CATEGORIES'>('TAXES');
  const [newCatName, setNewCatName] = useState('');
  const [localVatRate, setLocalVatRate] = useState(String(salonSettings.vatRate));

  useEffect(() => {
    setLocalVatRate(String(salonSettings.vatRate));
  }, [salonSettings.vatRate]);

  const saveVatRate = () => {
    const val = parseFloat(localVatRate);
    if (!isNaN(val) && val !== salonSettings.vatRate) {
      updateSalonSettings({ ...salonSettings, vatRate: val });
    }
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const colors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    updateExpenseCategories([...expenseCategories, {
      id: crypto.randomUUID(),
      name: newCatName,
      color: randomColor
    }]);
    setNewCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    updateExpenseCategories(expenseCategories.filter(c => c.id !== id));
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-white">
        <button onClick={() => navigate('/settings')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Paramètres Comptables</h2>
          <p className="text-xs text-slate-500">Gérez vos taxes et catégories de dépenses</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-slate-50 border-r border-slate-200 p-3 space-y-1 overflow-y-auto">
           {[
             { id: 'TAXES', label: 'Fiscalité', icon: Calculator },
             { id: 'CATEGORIES', label: 'Catégories', icon: Users },
           ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as 'TAXES' | 'CATEGORIES')}
               className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
             >
               <tab.icon size={16} />
               {tab.label}
             </button>
           ))}
        </div>

        <div className="flex-1 p-8 overflow-y-auto bg-white">
           {/* TAXES */}
           {activeTab === 'TAXES' && (
             <div className="max-w-xl space-y-8 animate-in fade-in">
               <div>
                 <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Fiscalité</h3>
                 <div className="max-w-xs">
                    <Input
                      label="Taux de TVA (%)"
                      type="number"
                      suffix="%"
                      value={localVatRate}
                      onChange={e => setLocalVatRate(e.target.value)}
                      onBlur={saveVatRate}
                      onKeyDown={e => { if (e.key === 'Enter') saveVatRate(); }}
                    />
                 </div>
                 {/* M-11: Single-rate caveat. The accounting module uses this rate
                     to estimate "TVA Provisionnée" for owner monitoring; it is
                     not a filing-grade calculation. */}
                 <div className="mt-3 max-w-xl flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                   <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                   <p className="text-xs text-blue-700 leading-relaxed">
                     Ce taux unique est appliqué à l'ensemble du chiffre d'affaires pour estimer la TVA à provisionner sur le tableau de bord. Il ne remplace pas votre déclaration officielle — vérifiez les taux applicables avec votre comptable.
                   </p>
                 </div>
               </div>
             </div>
           )}

           {/* CATEGORIES */}
           {activeTab === 'CATEGORIES' && (
              <div className="max-w-xl space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center">
                   <h3 className="text-base font-bold text-slate-900">Catégories de Dépenses</h3>
                </div>

                <div className="flex gap-2 mb-6">
                  <div className="flex-1">
                    <Input
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      placeholder="Nouvelle catégorie..."
                    />
                  </div>
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCatName}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm font-medium h-[42px]"
                  >
                    Ajouter
                  </button>
                </div>

                <div className="space-y-2">
                   {expenseCategories.map((cat) => (
                     <div key={cat.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className={`w-3 h-3 rounded-full ${cat.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                           <span className="font-medium text-slate-700 text-sm">{cat.name}</span>
                        </div>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <Trash2 size={16} />
                        </button>
                     </div>
                   ))}
                </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
