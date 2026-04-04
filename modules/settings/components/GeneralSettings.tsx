
import React, { useState, useRef } from 'react';
import { ArrowLeft, Save, Store, Camera, Loader2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { Section, Input, Select } from '../../../components/FormElements';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const GeneralSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { salonSettings, updateSalonSettings } = useSettings();
  const { activeSalon, refreshActiveSalon } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState(salonSettings);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    updateSalonSettings(formData);
    onBack();
  };

  const handleLogoUpload = async (file: File) => {
    if (!activeSalon) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      addToast({ type: 'error', message: 'Format accepté : JPEG, PNG ou WebP' });
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      addToast({ type: 'error', message: 'Le logo ne doit pas dépasser 2 Mo' });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${activeSalon.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(path);

      const logoUrl = `${publicUrl}?t=${Date.now()}`;

      // Update salons table
      const { error: updateError } = await supabase
        .from('salons')
        .update({ logo_url: logoUrl })
        .eq('id', activeSalon.id);

      if (updateError) throw updateError;

      // Sync local state
      setFormData(prev => ({ ...prev, logoUrl }));
      refreshActiveSalon({ logo_url: logoUrl });
      addToast({ type: 'success', message: 'Logo mis à jour' });
    } catch {
      addToast({ type: 'error', message: 'Impossible de mettre à jour le logo' });
    } finally {
      setIsUploadingLogo(false);
    }
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
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="relative w-24 h-24 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden group shrink-0 cursor-pointer hover:border-slate-300 transition-colors"
              >
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="bg-slate-100 w-full h-full flex items-center justify-center text-slate-400">
                    <Store size={32} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                  {isUploadingLogo ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <Camera size={18} />
                      <span className="text-[10px] mt-1 font-medium">Changer</span>
                    </>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = '';
                  }}
                />
              </button>
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
