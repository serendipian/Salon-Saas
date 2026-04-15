import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { useToast } from '../../context/ToastContext';
import { Input, TextArea, Section } from '../../components/FormElements';
import { PhoneInput } from '../../components/PhoneInput';

export const ProfileIdentity: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const { uploadAvatar, isUploading } = useAvatarUpload();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  useEffect(() => {
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setPhone(profile?.phone ?? '');
    setBio(profile?.bio ?? '');
  }, [profile?.first_name, profile?.last_name, profile?.phone, profile?.bio]);

  const initials =
    `${(profile?.first_name || '?')[0]}${(profile?.last_name || '?')[0]}`.toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatar(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      addToast({ type: 'error', message: 'Le prénom et le nom sont requis' });
      return;
    }
    setIsSaving(true);
    const { error } = await updateProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      bio: bio.trim() || null,
    });
    setIsSaving(false);
    if (error) {
      addToast({ type: 'error', message: 'Impossible de mettre à jour le profil' });
    } else {
      addToast({ type: 'success', message: 'Profil mis à jour' });
    }
  };

  return (
    <Section title="Identité">
      {/* Avatar */}
      <div className="flex items-center gap-6 mb-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group w-24 h-24 rounded-full shrink-0 overflow-hidden"
          disabled={isUploading}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center">
              <span className="font-bold text-2xl">{initials}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploading ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : (
              <>
                <Camera size={24} className="text-white" />
                <span className="text-white text-xs mt-1">Changer</span>
              </>
            )}
          </div>
        </button>
        <div>
          <p className="text-sm font-medium text-slate-900">Photo de profil</p>
          <p className="text-xs text-slate-500 mt-0.5">JPEG, PNG ou WebP. Max 2 Mo.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Prénom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Nom"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>
      <Input label="Email" value={profile?.email ?? ''} disabled className="mt-4" />
      <PhoneInput label="Téléphone" value={phone} onChange={setPhone} className="mt-4" />
      <TextArea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        placeholder="Décrivez votre spécialité, votre expérience..."
        className="mt-4"
      />

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </Section>
  );
};
