
import React, { useState } from 'react';
import { ArrowLeft, Save, Clock, Trash2 } from 'lucide-react';
import { Service, ServiceCategory, ServiceVariant } from '../../../types';
import { Section, Input, Select, TextArea } from '../../../components/FormElements';
import { useSettings } from '../../settings/hooks/useSettings';
import { useServiceSettings } from '../hooks/useServiceSettings';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { serviceSchema } from '../schemas';

interface ServiceFormProps {
  existingService?: Service;
  categories: ServiceCategory[];
  onSave: (s: Service) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
}

export const ServiceForm: React.FC<ServiceFormProps> = ({ existingService, categories, onSave, onDelete, onCancel }) => {
  const { salonSettings } = useSettings();
  const { serviceSettings } = useServiceSettings();
  const [formData, setFormData] = useState<Service>(existingService || {
    id: '',
    name: '',
    categoryId: categories[0]?.id || '',
    description: '',
    variants: [{ id: crypto.randomUUID(), name: serviceSettings.defaultVariantName, durationMinutes: serviceSettings.defaultDuration, price: 0, cost: 0, additionalCost: 0, isFavorite: false, favoriteSortOrder: 0 }],
    active: true,
    isFavorite: false,
    favoriteSortOrder: 0,
  });

  const { errors, validate, clearFieldError } = useFormValidation(serviceSchema);

  // Helper for dynamic currency display
  const currencySymbol = salonSettings.currency === 'USD' ? '$' : '€';

  const updateVariant = (id: string, field: keyof ServiceVariant, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  const handleSave = () => {
    const validated = validate(formData);
    if (!validated) return;
    onSave({ ...formData, name: validated.name, categoryId: validated.categoryId });
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { id: crypto.randomUUID(), name: '', durationMinutes: serviceSettings.defaultDuration, price: 0, cost: 0, additionalCost: 0, isFavorite: false, favoriteSortOrder: 0 }]
    }));
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingService ? 'Modifier le Service' : 'Nouveau Service'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          <Section title="Informations Générales">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="Nom du service"
                value={formData.name}
                onChange={e => { setFormData({...formData, name: e.target.value}); clearFieldError('name'); }}
                placeholder="Ex: Balayage Californien"
                error={errors.name}
              />
              <Select
                label="Catégorie"
                value={formData.categoryId}
                onChange={(val) => { setFormData({...formData, categoryId: val as string}); clearFieldError('categoryId'); }}
                options={categories.map(c => ({ value: c.id, label: c.name, initials: c.name.substring(0, 2).toUpperCase() }))}
                error={errors.categoryId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
              <TextArea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                rows={3}
                placeholder="Description marketing..."
              />
            </div>
          </Section>

          <Section 
            title="Variants & Tarifs" 
            action={
              <button onClick={addVariant} className="text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded transition-colors shadow-sm">
                + Ajouter
              </button>
            }
          >
            <div className="space-y-3">
               {formData.variants.map((variant) => (
                 <div key={variant.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                    <div className="flex-1 grid grid-cols-12 gap-3">
                      <div className="col-span-4">
                        <Input
                          label="Nom"
                          value={variant.name}
                          onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                          placeholder="Ex: Cheveux Longs"
                        />
                      </div>
                      <div className="col-span-2">
                         <Input
                            label="Durée"
                            icon={Clock}
                            suffix="min"
                            type="number"
                            value={variant.durationMinutes}
                            onChange={e => updateVariant(variant.id, 'durationMinutes', parseInt(e.target.value) || 0)}
                          />
                      </div>
                      <div className="col-span-2">
                         <Input
                            label="Prix"
                            prefix={currencySymbol}
                            type="number"
                            value={variant.price}
                            onChange={e => updateVariant(variant.id, 'price', parseFloat(e.target.value) || 0)}
                          />
                      </div>
                      <div className="col-span-2">
                         <Input
                            label="Coût"
                            type="number"
                            value={variant.cost}
                            onChange={e => updateVariant(variant.id, 'cost', parseFloat(e.target.value) || 0)}
                          />
                      </div>
                      <div className="col-span-2">
                         <Input
                            label="Coût add."
                            type="number"
                            min={0}
                            step={0.01}
                            value={variant.additionalCost}
                            onChange={e => updateVariant(variant.id, 'additionalCost', parseFloat(e.target.value) || 0)}
                          />
                      </div>
                    </div>
                    {formData.variants.length > 1 && (
                      <button onClick={() => setFormData(prev => ({...prev, variants: prev.variants.filter(v => v.id !== variant.id)}))} className="mt-6 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                 </div>
               ))}
            </div>
          </Section>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <Section title="Paramètres">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">Actif</span>
                <button 
                  onClick={() => setFormData({...formData, active: !formData.active})}
                  className={`w-10 h-5 rounded-full transition-colors relative ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                   <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
           </Section>

           <div className="flex flex-col gap-3 sticky top-6">
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
             {existingService && onDelete && (
               <button
                 onClick={() => {
                   if (window.confirm('Supprimer ce service ? Cette action est irréversible.')) {
                     onDelete(existingService.id);
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