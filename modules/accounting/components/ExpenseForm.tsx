
import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Save, Trash2, Banknote, CreditCard, Building2, FileCheck, ArrowRightLeft, Info, Upload, X, Image, FileText, Loader2, CheckCircle2, Home, Users, ShoppingCart, Megaphone, Layers, Zap, Wifi, Shield, Landmark, SprayCan, Wrench, Truck, Calculator, Receipt, Monitor, Armchair, CreditCard as CardIcon, Tag } from 'lucide-react';
import { Expense, ExpenseCategory, PaymentMethod } from '../../../types';
import { Section, Input, Select } from '../../../components/FormElements';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { useSettings } from '../../settings/hooks/useSettings';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { expenseSchema } from '../schemas';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'loyer': <Home size={14} />,
  'salaires': <Users size={14} />,
  'stock': <ShoppingCart size={14} />,
  'marketing': <Megaphone size={14} />,
  'divers': <Layers size={14} />,
  'charges & énergie': <Zap size={14} />,
  'communication': <Wifi size={14} />,
  'assurances': <Shield size={14} />,
  'crédits': <Landmark size={14} />,
  'nettoyage': <SprayCan size={14} />,
  'réparations': <Wrench size={14} />,
  'transport': <Truck size={14} />,
  'comptabilité': <Calculator size={14} />,
  'impôts & taxes': <Receipt size={14} />,
  'équipements': <Monitor size={14} />,
  'mobilier': <Armchair size={14} />,
  'abonnements': <CardIcon size={14} />,
};

const getCategoryIcon = (name: string) =>
  CATEGORY_ICONS[name.toLowerCase()] || <Tag size={14} />;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'especes', label: 'Espèces', icon: <Banknote size={16} /> },
  { value: 'carte', label: 'Carte bancaire', icon: <CreditCard size={16} /> },
  { value: 'virement', label: 'Virement', icon: <ArrowRightLeft size={16} /> },
  { value: 'cheque', label: 'Chèque', icon: <FileCheck size={16} /> },
  { value: 'prelevement', label: 'Prélèvement', icon: <Building2 size={16} /> },
];

interface ExpenseFormProps {
  existingExpense?: Expense;
  allExpenses?: Expense[];
  onSave: (e: Omit<Expense, 'id'>) => void;
  onUpdate?: (e: Expense) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ existingExpense, allExpenses = [], onSave, onUpdate, onDelete, onCancel, isPending }) => {
  const { expenseCategories, salonSettings } = useSettings();
  const { allSuppliers: suppliers, isLoading: isLoadingSuppliers } = useSuppliers();
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const { errors, validate, clearFieldError } = useFormValidation(expenseSchema);
  const isEdit = !!existingExpense;

  const [formData, setFormData] = useState<Partial<Expense>>(existingExpense || {
    description: '',
    amount: 0,
    date: new Date().toISOString().slice(0,10),
    category: '',
    supplierId: undefined,
    paymentMethod: undefined,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    existingExpense?.proofUrl ? 'Justificatif' : null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // M-8: Pre-select the first category once expenseCategories loads on a
  // brand-new form. Without this, the form starts with no category selected
  // and Zod fails on submit with no visual indication of what's wrong.
  useEffect(() => {
    if (isEdit) return;
    if (formData.category) return;
    if (expenseCategories.length === 0) return;
    setFormData((prev) => ({ ...prev, category: expenseCategories[0].id }));
  }, [isEdit, expenseCategories, formData.category]);
  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  const { supplierCategories } = useSuppliers();

  // Duplicate detection — warn on same amount + date + supplier
  const possibleDuplicate = useMemo(() => {
    if (!formData.amount || !formData.date) return null;
    const amt = Number(formData.amount);
    return allExpenses.find(e =>
      e.id !== existingExpense?.id &&
      e.amount === amt &&
      e.date === formData.date &&
      (e.supplierId ?? null) === (formData.supplierId ?? null)
    ) ?? null;
  }, [formData.amount, formData.date, formData.supplierId, allExpenses, existingExpense?.id]);

  const handleSubmit = () => {
    // M-5: belt-and-braces against rapid double-click. The Save button
    // is `disabled={isPending}`, but a click queued before the next React
    // render can still slip through.
    if (isPending) return;
    const validated = validate(formData);
    if (!validated) return;

    const selectedSupplier = formData.supplierId
      ? suppliers.find(s => s.id === formData.supplierId)
      : undefined;
    const expenseData = {
      description: formData.description!,
      amount: Number(formData.amount),
      date: formData.date || new Date().toISOString(),
      category: formData.category as ExpenseCategory,
      supplier: selectedSupplier?.name,
      supplierId: selectedSupplier?.id,
      paymentMethod: formData.paymentMethod,
      proofUrl: formData.proofUrl,
    };

    if (isEdit && onUpdate) {
      onUpdate({ ...expenseData, id: existingExpense!.id });
    } else {
      onSave(expenseData);
    }
  };

  const handleCategoryChange = (val: string) => {
    clearFieldError('category');
    setFormData({ ...formData, category: val, supplierId: undefined });
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSalon) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      addToast({ type: 'error', message: 'Format non supporté. Utilisez PDF, JPG, PNG ou WebP.' });
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      addToast({ type: 'error', message: 'Le fichier ne doit pas dépasser 5 Mo.' });
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${activeSalon.id}/receipts/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('receipts').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path);
      setFormData(prev => ({ ...prev, proofUrl: publicUrl }));
      setUploadedFileName(file.name);
      addToast({ type: 'success', message: 'Justificatif ajouté avec succès' });
    } catch {
      addToast({ type: 'error', message: 'Échec de l\'envoi du fichier. Veuillez réessayer.' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
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
        {/* Left Column — Core details */}
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
                    min="0"
                    step="0.01"
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

              {possibleDuplicate && (
                 <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 animate-in fade-in">
                    <Info size={16} className="shrink-0 mt-0.5 text-amber-500" />
                    <div>
                       <p className="font-medium">Doublon possible</p>
                       <p className="text-xs text-amber-600 mt-0.5">
                          Une dépense similaire existe déjà : « {possibleDuplicate.description} » — {possibleDuplicate.amount.toFixed(2)} {currencySymbol} le {new Date(possibleDuplicate.date).toLocaleDateString()}
                       </p>
                    </div>
                 </div>
              )}
           </Section>

           {/* Receipt Upload */}
           <Section title="Justificatif">
              {formData.proofUrl ? (
                 <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                       {uploadedFileName?.toLowerCase().endsWith('.pdf') ? <FileText size={18} /> : <Image size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                       <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <p className="text-sm font-medium text-emerald-800 truncate">{uploadedFileName || 'Justificatif ajouté'}</p>
                       </div>
                       <a href={formData.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">
                          Voir le fichier
                       </a>
                    </div>
                    <button
                       type="button"
                       onClick={() => { setFormData({ ...formData, proofUrl: undefined }); setUploadedFileName(null); }}
                       className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-colors"
                    >
                       <X size={16} />
                    </button>
                 </div>
              ) : (
                 <label className={`flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl transition-all ${
                    isUploading
                      ? 'border-blue-300 bg-blue-50 cursor-wait'
                      : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
                 }`}>
                    {isUploading ? (
                       <>
                          <Loader2 size={24} className="text-blue-500 animate-spin" />
                          <span className="text-sm font-medium text-blue-600">Envoi en cours...</span>
                          <div className="w-48 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                          </div>
                       </>
                    ) : (
                       <>
                          <Upload size={24} className="text-slate-400" />
                          <span className="text-sm text-slate-500">Glissez ou cliquez pour ajouter un justificatif</span>
                          <span className="text-xs text-slate-400">PDF, JPG, PNG, WebP (max 5 Mo)</span>
                       </>
                    )}
                    <input
                       type="file"
                       accept="image/jpeg,image/png,image/webp,application/pdf"
                       className="hidden"
                       onChange={handleReceiptUpload}
                       disabled={isUploading}
                    />
                 </label>
              )}
           </Section>
        </div>

        {/* Right Column — Classification & actions */}
        <div className="lg:col-span-1 space-y-6">
           {/* Category & Beneficiary */}
           <Section title="Catégorie & Bénéficiaire">
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">Catégorie <span className="text-red-500">*</span></label>
                 <div className="flex flex-wrap gap-1.5">
                    {expenseCategories.map((cat) => {
                       const isSelected = formData.category === cat.id;
                       return (
                          <button
                             key={cat.id}
                             type="button"
                             onClick={() => handleCategoryChange(cat.id)}
                             className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                isSelected
                                   ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                   : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                             }`}
                          >
                             {getCategoryIcon(cat.name)}
                             {cat.name}
                          </button>
                       );
                    })}
                 </div>
                 {errors.category && <p className="text-xs text-red-500 mt-1.5">{errors.category}</p>}
              </div>

              <Select
                 label="Bénéficiaire"
                 value={formData.supplierId ?? ''}
                 onChange={(val) => setFormData({ ...formData, supplierId: val ? (val as string) : undefined })}
                 searchable
                 placeholder={isLoadingSuppliers ? 'Chargement des fournisseurs…' : 'Rechercher un bénéficiaire...'}
                 options={
                   isLoadingSuppliers
                     ? [{ value: '', label: 'Chargement…' }]
                     : [
                         { value: '', label: 'Non spécifié' },
                         ...suppliers.map(s => {
                           const cat = supplierCategories.find(c => c.id === s.categoryId);
                           return {
                             value: s.id,
                             label: s.name,
                             subtitle: cat?.name,
                             initials: s.name.substring(0, 2).toUpperCase(),
                           };
                         }),
                       ]
                 }
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Le bénéficiaire doit exister dans la liste des fournisseurs. Pour ajouter un nouveau bénéficiaire, créez-le d'abord depuis le module Fournisseurs.
              </p>
           </Section>

           {/* Payment Method */}
           <Section title="Mode de paiement">
              <div className="grid grid-cols-2 gap-2">
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
                          className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
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

           <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
              <p className="mb-1 font-medium text-slate-700">Note:</p>
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
                 onClick={() => setShowDeleteConfirm(true)}
                 disabled={isPending}
                 className="w-full py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium transition-all text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
               >
                 <Trash2 size={16} />
                 Supprimer
               </button>
             )}
           </div>
        </div>
      </div>

      {isEdit && onDelete && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Supprimer cette dépense"
          tone="danger"
          confirmLabel="Supprimer"
          isLoading={isPending}
          onConfirm={() => {
            onDelete(existingExpense!.id);
            setShowDeleteConfirm(false);
          }}
          onClose={() => setShowDeleteConfirm(false)}
          message="Cette action est irréversible. La dépense sera définitivement supprimée de votre journal comptable."
        />
      )}
    </div>
  );
};
