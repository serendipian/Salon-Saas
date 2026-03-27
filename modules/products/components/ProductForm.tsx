
import React, { useState } from 'react';
import { ArrowLeft, Save, Sparkles, Box, AlertTriangle } from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { generateServiceDescription } from '../../../services/geminiService';
import { Section, Input, Select, TextArea } from '../../../components/FormElements';
import { useSettings } from '../../settings/hooks/useSettings';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { productSchema } from '../schemas';

interface ProductFormProps {
  existingProduct?: Product;
  categories: ProductCategory[];
  onSave: (p: Product, supplierId?: string | null) => void;
  onCancel: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ existingProduct, categories, onSave, onCancel }) => {
  const { salonSettings } = useSettings();
  const { allSuppliers } = useSuppliers();
  const [formData, setFormData] = useState<Product>(existingProduct || {
    id: '',
    name: '',
    description: '',
    categoryId: categories[0]?.id || '',
    price: 0,
    cost: 0,
    sku: '',
    barcode: '',
    stock: 0,
    supplier: '',
    active: true
  });

  const [supplierId, setSupplierId] = useState<string>(
    existingProduct?.supplier
      ? allSuppliers.find(s => s.name === existingProduct.supplier)?.id ?? ''
      : ''
  );

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const { errors, validate, clearFieldError } = useFormValidation(productSchema);

  const handleAiGenerate = async () => {
    if (!formData.name) return;
    setIsGeneratingAi(true);
    const catName = categories.find(c => c.id === formData.categoryId)?.name || "Produit";
    const desc = await generateServiceDescription(formData.name, catName, "vente, produit, avantages, utilisation");
    setFormData(prev => ({ ...prev, description: desc }));
    setIsGeneratingAi(false);
  };

  const handleSave = () => {
    const validated = validate(formData);
    if (!validated) return;
    onSave(formData, supplierId || null);
  };

  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

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
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Description</label>
                  <button 
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isGeneratingAi || !formData.name}
                    className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50 transition-colors"
                  >
                    <Sparkles size={12} />
                    {isGeneratingAi ? 'Rédaction...' : 'Rédiger avec IA'}
                  </button>
                </div>
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
           </div>

           <Section title="Organisation">
             <Select
               label="Catégorie"
               value={formData.categoryId}
               onChange={(val) => { setFormData({...formData, categoryId: val as string}); clearFieldError('categoryId'); }}
               options={categories.map(c => ({ value: c.id, label: c.name, initials: c.name.substring(0,2).toUpperCase() }))}
               error={errors.categoryId}
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