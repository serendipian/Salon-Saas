import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input, Section } from '../../components/FormElements';

export const ProfileSecurity: React.FC = () => {
  const { updatePassword } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword) {
      addToast({ type: 'error', message: 'Veuillez entrer votre mot de passe actuel' });
      return;
    }
    if (newPassword.length < 8) {
      addToast({
        type: 'error',
        message: 'Le nouveau mot de passe doit contenir au moins 8 caractères',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', message: 'Les mots de passe ne correspondent pas' });
      return;
    }
    if (newPassword === currentPassword) {
      addToast({
        type: 'error',
        message: "Le nouveau mot de passe doit être différent de l'actuel",
      });
      return;
    }

    setIsSaving(true);
    const { error } = await updatePassword(newPassword, currentPassword);
    setIsSaving(false);

    if (error) {
      addToast({ type: 'error', message: error });
    } else {
      addToast({ type: 'success', message: 'Mot de passe mis à jour' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Section title="Sécurité">
      <div className="space-y-4 max-w-sm">
        <Input
          label="Mot de passe actuel"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          icon={Lock}
          autoComplete="current-password"
        />
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 8 caractères"
          icon={Shield}
          autoComplete="new-password"
        />
        <Input
          label="Confirmer le nouveau mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button
          onClick={handleChangePassword}
          disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
        </button>
      </div>
    </Section>
  );
};
