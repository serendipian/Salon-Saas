
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Save, Trash2, Banknote, CreditCard, Building2, FileCheck, ArrowRightLeft, Info } from 'lucide-react';
import { Expense, ExpenseCategory, PaymentMethod } from '../../../types';
import { Section, Input, Select } from '../../../components/FormElements';
import { useSettings } from '../../settings/hooks/useSettings';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { expenseSchema } from '../schemas';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'especes', label: 'Espèces', icon: <Banknote size={16} /> },
  { value: 'carte', label: 'Carte bancaire', icon: <CreditCard size={16} /> },
  { value: 'virement', label: 'Virement', icon: <ArrowRightLeft size={16} /> },
  { value: 'cheque', label: 'Chèque', icon: <FileCheck size={16} /> },
  { value: 'prelevement', label: 'Prélèvement', icon: <Building2 size={16} /> },
];

interface ExpenseFormProps {
  existingExpense?: Expense;
  onSave: (e: Omit<Expense, 'id'>) => void;
  onUpdate?: (e: Expense) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ existingExpense, onSave, onUpdate, onDelete, onCancel, isPending }) => {
  const { expenseCategories, salonSettings } = useSettings();
  const { allSuppliers: suppliers } = useSuppliers();
  const { errors, validate, clearFieldError } = useFormValidation(expenseSchema);
  const isEdit = !!existingExpense;

  const [formData, setFormData] = useState<Partial<Expense>>(existingExpense || {
    description: '',
    amount: 0,
    date: new Date().toISOString().slice(0,10),
    category: '',
    supplier: '',
    paymentMethod: undefined,
  });

  const [isCustomSupplier, setIsCustomSupplier] = useState(
    isEdit && existingExpense.supplier && !existingExpense.supplierId
  );
  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  // Filter suppliers by selected expense category name
  const filteredSuppliers = useMemo(() => {
    if (!formData.category) return suppliers;
    const selectedCat = expenseCategories.find(c => c.id === formData.category);
    if (!selectedCat) return suppliers;
    const catName = selectedCat.name.toLowerCase();
    const matched = suppliers.filter(s =>
      s.category && (
        s.category.toLowerCase().includes(catName) ||
        catName.includes(s.category.toLowerCase())
      )
    );
    return matched.length > 0 ? matched : suppliers;
  }, [formData.category, suppliers, expenseCategories]);

  const handleSubmit = () => {
    const validated = validate(formData);
    if (!validated) return;

    const selectedSupplier = !isCustomSupplier
      ? suppliers.find(s => s.id === formData.supplier)
      : undefined;
    const expenseData = {
      description: formData.description!,
      amount: Number(formData.amount),
      date: formData.date || new Date().toISOString(),
      category: (formData.category || expenseCategories[0]?.id) as ExpenseCategory,
      supplier: selectedSupplier?.name ?? formData.supplier,
      supplierId: selectedSupplier?.id,
      paymentMethod: formData.paymentMethod,
    };

    if (isEdit && onUpdate) {
      onUpdate({ ...expenseData, id: existingExpense!.id });
    } else {
      onSave(expenseData);
    }
  };

  const handleCategoryChange = (val: string) => {
    clearFieldError('category');
    // Reset supplier when category changes (since supplier list will change)
    setFormData({ ...formData, category: val, supplier: '', supplierId: undefined });
    setIsCustomSupplier(false);
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">{isEdit ? 'Modifier la Dépense' : 'Nouvelle Dépense'}</h1>
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

           {/* Category → Supplier cascade */}
           <Section title="Catégorie & Fournisseur">
              <Select
                 label="Catégorie"
                 value={formData.category}
                 onChange={handleCategoryChange}
                 error={errors.category}
                 required
                 options={expenseCategories.map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                    initials: cat.name.substring(0,2).toUpperCase()
                 }))}
              />

              <div className={!formData.category ? 'opacity-50 pointer-events-none' : ''}>
                 <Select
                    label="Fournisseur"
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
                    placeholder={!formData.category ? 'Sélectionnez une catégorie d\'abord...' : 'Rechercher un fournisseur...'}
                    options={[
                       { value: '', label: 'Non spécifié' },
                       ...filteredSuppliers.map(s => ({
                          value: s.id,
                          label: s.name,
                          subtitle: s.category,
                          initials: s.name.substring(0, 2).toUpperCase()
                       })),
                       { value: '__OTHER__', label: 'Autre / Saisir manuellement...', initials: '+' }
                    ]}
                 />
                 {!formData.category && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                       <Info size={12} /> Sélectionnez une catégorie pour filtrer les fournisseurs
                    </p>
                 )}
              </div>

              {isCustomSupplier && (
                 <div className="animate-in slide-in-from-top-2">
                    <Input
                       label="Nom du fournisseur manuel"
                       autoFocus
                       value={formData.supplier}
                       onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                       placeholder="Saisir le nom..."
                    />
                 </div>
              )}
           </Section>

           {/* Payment Method */}
           <Section title="Mode de paiement">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                 {PAYMENT_METHODS.map((method) => {
                    const isSelected = formData.paymentMethod === method.value;
                    return (
                       <button
                          key={method.value}
                          type="button"
                          onClick={() => setFormData({
                             ...formData,
                             paymentMethod: isSelected ? undefined : method.value,
                          })}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                             isSelected
                                ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                       >
                          {method.icon}
                          <span className="text-xs">{method.label}</span>
                       </button>
                    );
                 })}
              </div>
           </Section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
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
             {isEdit && onDelete && (
               <button
                 onClick={() => {
                   if (window.confirm('Supprimer cette dépense ? Cette action est irréversible.')) {
                     onDelete(existingExpense!.id);
                   }
                 }}
                 className="w-full py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium transition-all text-sm flex justify-center items-center gap-2"
               >
                 <Trash2 size={16} />
                 Supprimer
               </button>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};
