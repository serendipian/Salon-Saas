
import React, { useState } from 'react';
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { Product, ProductCategory, UsageType } from '../../../types';
import { Section, Input, Select, TextArea } from '../../../components/FormElements';
import { useSettings } from '../../settings/hooks/useSettings';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useProducts } from '../hooks/useProducts';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { productSchema } from '../schemas';

interface ProductFormProps {
  existingProduct?: Product;
  categories: ProductCategory[];
  onSave: (p: Product, supplierId?: string | null) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const USAGE_TYPE_OPTIONS: { value: UsageType; label: string; description: string }[] = [
  { value: 'retail', label: 'Revente', description: 'Vendu aux clients' },
  { value: 'internal', label: 'Interne', description: 'Usage salon uniquement' },
  { value: 'both', label: 'Mixte', description: 'Usage interne + revente' },
];

export const ProductForm: React.FC<ProductFormProps> = ({ existingProduct, categories, onSave, onCancel, onDelete }) => {
  const { salonSettings } = useSettings();
  const { allSuppliers } = useSuppliers();
  const { brands } = useProducts();
  const [formData, setFormData] = useState<Product>(existingProduct || {
    id: '',
    name: '',
    description: '',
    categoryId: categories[0]?.id || '',
    brandId: '',
    usageType: 'retail',
    price: 0,
    cost: 0,
    sku: '',
    barcode: '',
    stock: 0,
    supplier: '',
    active: true
  });

  const [supplierId, setSupplierId] = useState<string>(
    existingProduct?.supplierId ?? ''
  );

  const { errors, validate, clearFieldError } = useFormValidation(productSchema);

  const handleSave = () => {
    const validated = validate(formData);
    if (!validated) return;
    onSave({ ...formData, ...validated }, supplierId || null);
  };

  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  // Filter brands by selected supplier (if any), or show all
  const availableBrands = supplierId
    ? brands.filter(b => !b.supplierId || b.supplierId === supplierId)
    : brands;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingProduct ? 'Modifier le Produit' : 'Nouveau Produit'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Détails du Produit">
             <Input
               label="Titre"
               value={formData.name}
               onChange={e => { setFormData({...formData, name: e.target.value}); clearFieldError('name'); }}
               error={errors.name}
             />
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <TextArea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={5}
                />
             </div>
          </Section>

          <Section title="Prix & Coûts">
             <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Prix Public"
                  type="number"
                  prefix={currencySymbol}
                  value={formData.price}
                  onChange={e => { setFormData({...formData, price: parseFloat(e.target.value)}); clearFieldError('price'); }}
                  error={errors.price}
                />
                <Input
                  label="Coût d'achat"
                  type="number"
                  prefix={currencySymbol}
                  value={formData.cost}
                  onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})}
                />
             </div>
          </Section>

          <Section title="Inventaire">
             <div className="grid grid-cols-2 gap-4 mb-4">
                <Input
                  label="SKU (Référence)"
                  value={formData.sku}
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                />
                <Input
                  label="Code-barres"
                  value={formData.barcode || ''}
                  onChange={e => setFormData({...formData, barcode: e.target.value})}
                />
             </div>
             <div className="flex items-center gap-4">
                <Input
                   label="Quantité en stock"
                   type="number"
                   value={formData.stock}
                   onChange={e => { setFormData({...formData, stock: parseInt(e.target.value)}); clearFieldError('stock'); }}
                   className="w-32"
                   error={errors.stock}
                />
                {formData.stock <= 5 && (
                   <div className="flex items-center gap-2 text-amber-700 text-xs bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 mt-6">
                      <AlertTriangle size={14} />
                      <span>Stock faible</span>
                   </div>
                )}
             </div>
          </Section>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <div className="flex flex-col gap-3 sticky top-6 z-10">
             <button
              onClick={handleSave}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
            >
               <Save size={16} />
               Enregistrer
             </button>
             <button
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
             {onDelete && (
               <button
                 type="button"
                 onClick={onDelete}
                 className="w-full py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium transition-all text-sm"
               >
                 Supprimer
               </button>
             )}
           </div>

           <Section title="Type d'utilisation">
             <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
               {USAGE_TYPE_OPTIONS.map((opt) => (
                 <button
                   key={opt.value}
                   type="button"
                   onClick={() => setFormData({...formData, usageType: opt.value})}
                   className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors text-center ${
                     formData.usageType === opt.value
                       ? 'bg-white text-slate-900 shadow-sm'
                       : 'text-slate-500 hover:text-slate-700'
                   }`}
                   title={opt.description}
                 >
                   {opt.label}
                 </button>
               ))}
             </div>
             <p className="text-xs text-slate-500 mt-1.5">
               {USAGE_TYPE_OPTIONS.find(o => o.value === formData.usageType)?.description}
             </p>
           </Section>

           <Section title="Organisation">
             <Select
               label="Catégorie"
               value={formData.categoryId}
               onChange={(val) => { setFormData({...formData, categoryId: val as string}); clearFieldError('categoryId'); }}
               options={categories.map(c => ({ value: c.id, label: c.name, initials: c.name.substring(0,2).toUpperCase() }))}
               error={errors.categoryId}
             />
             <Select
               label="Marque"
               value={formData.brandId ?? ''}
               onChange={(val) => setFormData({...formData, brandId: (val as string) || undefined})}
               options={[
                 { value: '', label: 'Aucune marque', initials: '--' },
                 ...availableBrands.map(b => ({ value: b.id, label: b.name, initials: b.name.substring(0, 2).toUpperCase() }))
               ]}
             />
             <Select
               label="Fournisseur"
               value={supplierId}
               onChange={(val) => {
                 setSupplierId(val as string);
                 const supplierName = allSuppliers.find(s => s.id === val)?.name ?? '';
                 setFormData({...formData, supplier: supplierName});
               }}
               options={[
                 { value: '', label: 'Aucun fournisseur', initials: '--' },
                 ...allSuppliers.map(s => ({ value: s.id, label: s.name, initials: s.name.substring(0, 2).toUpperCase() }))
               ]}
             />
           </Section>

           <Section title="Visibilité">
              <Select
                value={formData.active ? 'active' : 'draft'}
                onChange={(val) => setFormData({...formData, active: val === 'active'})}
                options={[
                  { value: 'active', label: 'Actif (Visible)', initials: 'OK' },
                  { value: 'draft', label: 'Brouillon (Caché)', initials: 'XX' }
                ]}
              />
           </Section>
        </div>
      </div>
    </div>
  );
};
