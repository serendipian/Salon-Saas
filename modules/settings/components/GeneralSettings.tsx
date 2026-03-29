
import React, { useState } from 'react';
import { ArrowLeft, Save, Store } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { Section, Input, Select } from '../../../components/FormElements';

export const GeneralSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { salonSettings, updateSalonSettings } = useSettings();
  const [formData, setFormData] = useState(salonSettings);

  const handleSave = () => {
    updateSalonSettings(formData);
    onBack();
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 w-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Paramètres Généraux</h1>
        <div className="ml-auto">
           <button 
             onClick={handleSave}
             className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
           >
             <Save size={16} />
             Enregistrer
           </button>
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Identité de l'établissement">
           <div className="flex items-start gap-6">
              <div className="w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
                 <Store size={32} />
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input 
                   label="Nom du Salon" 
                   value={formData.name} 
                   onChange={e => setFormData({...formData, name: e.target.value})} 
                 />
                 <Input 
                   label="Site Web" 
                   value={formData.website} 
                   onChange={e => setFormData({...formData, website: e.target.value})} 
                 />
                 <div className="md:col-span-2">
                   <Input 
                     label="Adresse Complète" 
                     value={formData.address} 
                     onChange={e => setFormData({...formData, address: e.target.value})} 
                   />
                 </div>
              </div>
           </div>
        </Section>

        <Section title="Coordonnées de Contact">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Email" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
              />
              <Input 
                label="Téléphone" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
           </div>
        </Section>

        <Section title="Préférences Financières">
          <div className="max-w-xs">
            <Select
              label="Devise"
              value={formData.currency}
              onChange={(val) => setFormData({...formData, currency: val as string})}
              options={[
                { value: 'EUR', label: 'Euro (€)' },
                { value: 'USD', label: 'Dollar US ($)' },
                { value: 'MAD', label: 'Dirham Marocain (MAD)' },
                { value: 'GBP', label: 'Livre Sterling (£)' },
                { value: 'CAD', label: 'Dollar Canadien ($)' },
                { value: 'CHF', label: 'Franc Suisse (CHF)' }
              ]}
            />
          </div>
        </Section>
      </div>
    </div>
  );
};
