import { ArrowLeft, Camera, Loader2, Save, Store } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Section, Select } from '../../../components/FormElements';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import { useSettings } from '../hooks/useSettings';

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const GeneralSettings: React.FC = () => {
  const navigate = useNavigate();
  const { salonSettings, updateSalonSettings } = useSettings();
  const { activeSalon, refreshActiveSalon } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState(salonSettings);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Sync form state when real data arrives (initial load returns defaults)
  useEffect(() => {
    setFormData(salonSettings);
  }, [salonSettings]);

  const set = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSalonSettings(formData);
      navigate('/settings');
    } catch {
      // Error toast handled by mutation's onError
    } finally {
      setIsSaving(false);
    }
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

      const {
        data: { publicUrl },
      } = supabase.storage.from('logos').getPublicUrl(path);

      const logoUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('salons')
        .update({ logo_url: logoUrl })
        .eq('id', activeSalon.id);

      if (updateError) throw updateError;

      setFormData((prev) => ({ ...prev, logoUrl }));
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
        <button
          onClick={() => navigate('/settings')}
          className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
        >
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Identity */}
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
              <div className="flex-1 space-y-4">
                <Input
                  label="Nom du Salon"
                  value={formData.name}
                  onChange={(e) => set('name', e.target.value)}
                />
                <Input
                  label="Site Web"
                  value={formData.website}
                  onChange={(e) => set('website', e.target.value)}
                  placeholder="https://monsalon.com"
                />
              </div>
            </div>
          </Section>

          {/* Address */}
          <Section title="Adresse">
            <div className="space-y-4">
              <Input
                label="Rue"
                value={formData.street}
                onChange={(e) => set('street', e.target.value)}
                placeholder="123 Rue de la Beauté"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Ville"
                  value={formData.city}
                  onChange={(e) => set('city', e.target.value)}
                />
                <Input
                  label="Quartier"
                  value={formData.neighborhood}
                  onChange={(e) => set('neighborhood', e.target.value)}
                  placeholder="Ex: Maarif, Marais..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Code Postal"
                  value={formData.postalCode}
                  onChange={(e) => set('postalCode', e.target.value)}
                />
                <Input
                  label="Pays"
                  value={formData.country}
                  onChange={(e) => set('country', e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* Contact */}
          <Section title="Coordonnées de Contact">
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => set('email', e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Téléphone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
                <Input
                  label="WhatsApp"
                  type="tel"
                  value={formData.whatsapp}
                  onChange={(e) => set('whatsapp', e.target.value)}
                  placeholder="+212 6XX XXX XXX"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Right column — sidebar */}
        <div className="lg:w-80 xl:w-96 shrink-0 space-y-6">
          {/* Social Media */}
          <Section title="Réseaux Sociaux">
            <div className="space-y-4">
              <Input
                label="Instagram"
                value={formData.instagram}
                onChange={(e) => set('instagram', e.target.value)}
                placeholder="@monsalon"
              />
              <Input
                label="Facebook"
                value={formData.facebook}
                onChange={(e) => set('facebook', e.target.value)}
                placeholder="https://facebook.com/monsalon"
              />
              <Input
                label="TikTok"
                value={formData.tiktok}
                onChange={(e) => set('tiktok', e.target.value)}
                placeholder="@monsalon"
              />
              <Input
                label="Google Maps"
                value={formData.googleMapsUrl}
                onChange={(e) => set('googleMapsUrl', e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
          </Section>

          {/* Business & Financial */}
          <Section title="Informations Légales & Financières">
            <div className="space-y-4">
              <Input
                label="N° d'enregistrement"
                value={formData.businessRegistration}
                onChange={(e) => set('businessRegistration', e.target.value)}
                placeholder="SIRET, ICE, RC..."
              />
              <Select
                label="Devise"
                value={formData.currency}
                onChange={(val) => set('currency', val as string)}
                options={[
                  { value: 'EUR', label: 'Euro (€)' },
                  { value: 'USD', label: 'Dollar US ($)' },
                  { value: 'MAD', label: 'Dirham Marocain (MAD)' },
                  { value: 'GBP', label: 'Livre Sterling (£)' },
                  { value: 'CAD', label: 'Dollar Canadien ($)' },
                  { value: 'CHF', label: 'Franc Suisse (CHF)' },
                ]}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};
