
import React, { useState } from 'react';
import { Calculator, Users, RefreshCw, FileText, ArrowLeft, Plus, Trash2, Database } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { RecurringExpense } from '../../../types';
import { Input, Select } from '../../../components/FormElements';

export const AccountingSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { 
    expenseCategories, 
    recurringExpenses, 
    updateExpenseCategories, 
    updateRecurringExpenses,
    salonSettings
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'TAXES' | 'CATEGORIES' | 'RECURRING' | 'EXPORT'>('TAXES');
  const [newCatName, setNewCatName] = useState('');
  const [newRecExpense, setNewRecExpense] = useState<Partial<RecurringExpense>>({
    name: '',
    amount: 0,
    frequency: 'Mensuel',
    nextDate: new Date().toISOString().slice(0, 10)
  });
  const [isAddingRec, setIsAddingRec] = useState(false);

  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const colors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    updateExpenseCategories([...expenseCategories, {
      id: `cat-${Date.now()}`,
      name: newCatName,
      color: randomColor
    }]);
    setNewCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    updateExpenseCategories(expenseCategories.filter(c => c.id !== id));
  };

  const handleAddRecurring = () => {
    if (!newRecExpense.name || !newRecExpense.amount) return;
    
    updateRecurringExpenses([...recurringExpenses, {
      id: `rec-${Date.now()}`,
      name: newRecExpense.name!,
      amount: Number(newRecExpense.amount),
      frequency: newRecExpense.frequency as any,
      nextDate: newRecExpense.nextDate || new Date().toISOString()
    }]);
    setIsAddingRec(false);
    setNewRecExpense({ name: '', amount: 0, frequency: 'Mensuel', nextDate: new Date().toISOString().slice(0, 10) });
  };

  const handleDeleteRecurring = (id: string) => {
    updateRecurringExpenses(recurringExpenses.filter(r => r.id !== id));
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-white">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Paramètres Comptables</h2>
          <p className="text-xs text-slate-500">Gérez vos taxes, catégories et récurrences</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-slate-50 border-r border-slate-200 p-3 space-y-1 overflow-y-auto">
           {[
             { id: 'TAXES', label: 'Fiscalité', icon: Calculator },
             { id: 'CATEGORIES', label: 'Catégories', icon: Users },
             { id: 'RECURRING', label: 'Dépenses Récurrentes', icon: RefreshCw },
             { id: 'EXPORT', label: 'Export Données', icon: FileText },
           ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
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
                 <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">TVA & Devise</h3>
                 <div className="grid grid-cols-2 gap-6">
                    <Input 
                      label="Taux de TVA (%)"
                      type="number"
                      suffix="%"
                      defaultValue={20}
                    />
                    <Select 
                      label="Devise"
                      value="EUR"
                      onChange={() => {}}
                      options={[
                        { value: 'EUR', label: 'EUR (€)' },
                        { value: 'USD', label: 'USD ($)' }
                      ]}
                    />
                 </div>
               </div>
               <div className="flex justify-end">
                 <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800">Enregistrer</button>
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

           {/* RECURRING */}
           {activeTab === 'RECURRING' && (
             <div className="max-w-2xl space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-900">Charges Fixes Automatiques</h3>
                  {!isAddingRec && (
                    <button 
                      onClick={() => setIsAddingRec(true)}
                      className="text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Plus size={16} /> Ajouter
                    </button>
                  )}
                </div>

                {isAddingRec && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 animate-in slide-in-from-top-2">
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Nouvelle charge</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                       <Input 
                         label="Nom"
                         value={newRecExpense.name}
                         onChange={e => setNewRecExpense({...newRecExpense, name: e.target.value})}
                         placeholder="Ex: Loyer" 
                       />
                       <Input 
                         label={`Montant (${currencySymbol})`}
                         type="number"
                         value={newRecExpense.amount}
                         onChange={e => setNewRecExpense({...newRecExpense, amount: parseFloat(e.target.value)})}
                       />
                       <Select 
                         label="Fréquence"
                         value={newRecExpense.frequency}
                         onChange={(val) => setNewRecExpense({...newRecExpense, frequency: val as any})}
                         options={[
                           { value: 'Mensuel', label: 'Mensuel' },
                           { value: 'Annuel', label: 'Annuel' },
                           { value: 'Hebdomadaire', label: 'Hebdomadaire' }
                         ]}
                       />
                        <Input 
                         label="Prochaine échéance"
                         type="date"
                         value={newRecExpense.nextDate}
                         onChange={e => setNewRecExpense({...newRecExpense, nextDate: e.target.value})}
                       />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setIsAddingRec(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
                      <button onClick={handleAddRecurring} className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">Confirmer</button>
                    </div>
                  </div>
                )}

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                         <tr className="text-xs font-semibold text-slate-500 uppercase">
                            <th className="px-4 py-3">Nom</th>
                            <th className="px-4 py-3">Montant</th>
                            <th className="px-4 py-3">Fréquence</th>
                            <th className="px-4 py-3">Prochaine</th>
                            <th className="px-4 py-3"></th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {recurringExpenses.map((rec) => (
                           <tr key={rec.id} className="text-sm hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-3 font-medium text-slate-900">{rec.name}</td>
                              <td className="px-4 py-3 text-slate-600 font-medium">{rec.amount} €</td>
                              <td className="px-4 py-3">
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                                    <RefreshCw size={10} /> {rec.frequency}
                                 </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500">{new Date(rec.nextDate).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-right">
                                 <button 
                                  onClick={() => handleDeleteRecurring(rec.id)}
                                  className="text-slate-300 hover:text-red-600 transition-colors"
                                >
                                   <Trash2 size={16} />
                                 </button>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
           )}

           {/* EXPORT */}
           {activeTab === 'EXPORT' && (
              <div className="max-w-xl space-y-6 animate-in fade-in">
                 <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">Exports Données</h3>
                 <div className="grid grid-cols-1 gap-4">
                    <button className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-900 hover:shadow-sm transition-all group text-left">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                             <FileText size={20} />
                          </div>
                          <div>
                             <div className="font-bold text-slate-900">Grand Livre (CSV)</div>
                             <div className="text-xs text-slate-500">Détail complet des transactions.</div>
                          </div>
                       </div>
                       <div className="text-sm font-medium text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                          Télécharger
                       </div>
                    </button>
                    <button className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-900 hover:shadow-sm transition-all group text-left">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                             <Database size={20} />
                          </div>
                          <div>
                             <div className="font-bold text-slate-900">Fichier FEC</div>
                             <div className="text-xs text-slate-500">Pour l'administration fiscale.</div>
                          </div>
                       </div>
                       <div className="text-sm font-medium text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                          Générer
                       </div>
                    </button>
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
