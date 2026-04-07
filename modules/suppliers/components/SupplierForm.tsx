
import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Supplier } from '../../../types';
import { Section, Input, TextArea, Select } from '../../../components/FormElements';
import { PhoneInput } from '../../../components/PhoneInput';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { supplierSchema } from '../schemas';

interface SupplierFormProps {
  existingSupplier?: Supplier;
  onSave: (s: Supplier) => void;
  onCancel: () => void;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({ existingSupplier, onSave, onCancel }) => {
  const { errors, validate, clearFieldError } = useFormValidation(supplierSchema);
  const [formData, setFormData] = useState<Supplier>(existingSupplier || {
    id: '',
    name: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    category: 'Produits Coiffure',
    paymentTerms: '30 jours',
    active: true,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validate(formData);
    if (!validated) return;
    onSave(formData);
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           
           <Section title="Informations Entreprise">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Nom de l'entreprise"
                  required
                  value={formData.name}
                  onChange={e => { clearFieldError('name'); setFormData({...formData, name: e.target.value}); }}
                  placeholder="Ex: L'Oréal Pro"
                  error={errors.name}
                />
                <Input 
                  label="Site Web"
                  value={formData.website}
                  onChange={e => setFormData({...formData, website: e.target.value})}
                  placeholder="www.exemple.com"
                />
              </div>
              <TextArea 
                label="Adresse"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                rows={2}
                placeholder="Adresse postale complète..."
              />
           </Section>

           <Section title="Contact Principal">
              <Input
                label="Nom du contact"
                value={formData.contactName}
                onChange={e => setFormData({...formData, contactName: e.target.value})}
                placeholder="Ex: Jean Dupont"
              />
              <div className="grid grid-cols-2 gap-5">
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={e => { clearFieldError('email'); setFormData({...formData, email: e.target.value}); }}
                  placeholder="contact@email.com"
                  error={errors.email}
                />
                <PhoneInput
                  label="Téléphone"
                  value={formData.phone}
                  onChange={phone => setFormData({...formData, phone})}
                />
              </div>
           </Section>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <div className="flex flex-col gap-3 sticky top-6 z-10">
             <button 
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
            >
               <Save size={16} />
               Enregistrer
             </button>
             <button 
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
           </div>

           <Section title="Paramètres">
              <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-700 font-medium">Fournisseur Actif</span>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.active ? 'left-5' : 'left-0.5'}`} />
                  </button>
              </div>

              <Select
                 label="Catégorie"
                 value={formData.category}
                 onChange={(val) => { clearFieldError('category'); setFormData({...formData, category: val as string}); }}
                 error={errors.category}
                 options={[
                   { value: "Produits Coiffure", label: "Produits Coiffure" },
                   { value: "Produits Esthétique", label: "Produits Esthétique" },
                   { value: "Matériel", label: "Matériel" },
                   { value: "Mobilier", label: "Mobilier" },
                   { value: "Charges & Services", label: "Charges & Services" },
                   { value: "Autre", label: "Autre" }
                 ]}
              />

              <Input 
                 label="Conditions de Paiement"
                 value={formData.paymentTerms}
                 onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                 placeholder="Ex: 30 jours"
              />
           </Section>

           <Section title="Notes Internes">
              <TextArea 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                rows={4}
                placeholder="Notes sur le fournisseur..."
              />
           </Section>
        </div>
      </form>
    </div>
  );
};
