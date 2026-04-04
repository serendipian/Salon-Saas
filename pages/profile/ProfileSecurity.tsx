import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input, Section } from '../../components/FormElements';

export const ProfileSecurity: React.FC = () => {
  const { updatePassword } = useAuth();
  const { addToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      addToast({ type: 'error', message: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', message: 'Les mots de passe ne correspondent pas' });
      return;
    }

    setIsSaving(true);
    const { error } = await updatePassword(newPassword);
    setIsSaving(false);

    if (error) {
      addToast({ type: 'error', message: error });
    } else {
      addToast({ type: 'success', message: 'Mot de passe mis à jour' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Section title="Sécurité">
      <div className="space-y-4 max-w-sm">
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 8 caractères"
          icon={Shield}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          onClick={handleChangePassword}
          disabled={isSaving || !newPassword}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
        </button>
      </div>
    </Section>
  );
};
