
import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Expense, ExpenseCategory } from '../../../types';
import { Section, Input, Select, TextArea } from '../../../components/FormElements';
import { useSettings } from '../../settings/hooks/useSettings';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { expenseSchema } from '../schemas';

interface ExpenseFormProps {
  onSave: (e: Omit<Expense, 'id'>) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSave, onCancel, isPending }) => {
  const { expenseCategories, salonSettings } = useSettings();
  const { allSuppliers: suppliers } = useSuppliers();
  const { errors, validate, clearFieldError } = useFormValidation(expenseSchema);

  const [formData, setFormData] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    date: new Date().toISOString().slice(0,10),
    category: expenseCategories[0]?.id || '', 
    supplier: ''
  });
  
  const [isCustomSupplier, setIsCustomSupplier] = useState(false);
  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  const handleSubmit = () => {
    const validated = validate(formData);
    if (!validated) return;

    const selectedSupplier = !isCustomSupplier
      ? suppliers.find(s => s.id === formData.supplier)
      : undefined;
    onSave({
      description: formData.description!,
      amount: Number(formData.amount),
      date: formData.date || new Date().toISOString(),
      category: (formData.category || expenseCategories[0]?.id) as ExpenseCategory,
      supplier: selectedSupplier?.name ?? formData.supplier,
      supplierId: selectedSupplier?.id,
    });
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Nouvelle Dépense</h1>
        <div className="ml-auto">
           <button
             onClick={handleSubmit}
             disabled={isPending}
             className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Save size={16} />
             {isPending ? 'Enregistrement...' : 'Enregistrer'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
           <Section title="Détails de la dépense">
              <Input
                 label="Description"
                 value={formData.description}
                 onChange={(e) => { clearFieldError('description'); setFormData({...formData, description: e.target.value}); }}
                 placeholder="Ex: Facture EDF, Achat Stock..."
                 required
                 error={errors.description}
              />
              
              <div className="grid grid-cols-2 gap-4">
                 <Input
                    label="Montant"
                    type="number"
                    prefix={currencySymbol}
                    value={formData.amount}
                    onChange={(e) => { clearFieldError('amount'); setFormData({...formData, amount: parseFloat(e.target.value)}); }}
                    placeholder="0.00"
                    required
                    error={errors.amount}
                 />
                 <Input
                    label="Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => { clearFieldError('date'); setFormData({...formData, date: e.target.value}); }}
                    required
                    error={errors.date}
                 />
              </div>
           </Section>

           <Section title="Fournisseur">
              <div>
                 <Select
                    label="Sélectionner un fournisseur"
                    value={isCustomSupplier ? '__OTHER__' : formData.supplier || ''}
                    onChange={(val) => {
                       if (val === '__OTHER__') {
                          setIsCustomSupplier(true);
                          setFormData({...formData, supplier: ''});
                       } else {
                          setIsCustomSupplier(false);
                          setFormData({...formData, supplier: val as string});
                       }
                    }}
                    searchable
                    placeholder="Rechercher un fournisseur..."
                    options={[
                       { value: '', label: 'Non spécifié' },
                       ...suppliers.map(s => ({
                          value: s.id,
                          label: s.name,
                          subtitle: s.category,
                          initials: s.name.substring(0, 2).toUpperCase()
                       })),
                       { value: '__OTHER__', label: 'Autre / Saisir manuellement...', initials: '+' }
                    ]}
                 />
                 
                 {isCustomSupplier && (
                    <div className="mt-4 animate-in slide-in-from-top-2">
                       <Input 
                          label="Nom du fournisseur manuel"
                          autoFocus
                          value={formData.supplier}
                          onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                          placeholder="Saisir le nom..." 
                       />
                    </div>
                 )}
              </div>
           </Section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
           <Section title="Catégorisation">
              <Select
                 label="Catégorie"
                 value={formData.category}
                 onChange={(val) => { clearFieldError('category'); setFormData({...formData, category: val as string}); }}
                 error={errors.category}
                 options={expenseCategories.map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                    initials: cat.name.substring(0,2).toUpperCase()
                 }))}
              />
           </Section>

           <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
              <p className="mb-2 font-medium text-slate-700">Note:</p>
              <p>Assurez-vous que le montant correspond bien au total TTC de la facture.</p>
           </div>
           
           <div className="flex flex-col gap-3">
             <button 
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};