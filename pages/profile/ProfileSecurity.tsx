import React, { useState } from 'react';
import { Shield, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input, Section } from '../../components/FormElements';

export const ProfileSecurity: React.FC = () => {
  const { updatePassword, reauthenticate, profile } = useAuth();
  const { addToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nonce, setNonce] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setNonce('');
    setCodeSent(false);
  };

  const handleRequestCode = async () => {
    if (newPassword.length < 8) {
      addToast({ type: 'error', message: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', message: 'Les mots de passe ne correspondent pas' });
      return;
    }

    setIsSending(true);
    const { error } = await reauthenticate();
    setIsSending(false);

    if (error) {
      addToast({ type: 'error', message: error });
      return;
    }

    setCodeSent(true);
    addToast({ type: 'info', message: 'Un code de vérification vous a été envoyé par email' });
  };

  const handleConfirmChange = async () => {
    if (nonce.trim().length === 0) {
      addToast({ type: 'error', message: 'Veuillez entrer le code reçu par email' });
      return;
    }

    setIsSaving(true);
    const { error } = await updatePassword(newPassword, nonce.trim());
    setIsSaving(false);

    if (error) {
      addToast({ type: 'error', message: error });
    } else {
      addToast({ type: 'success', message: 'Mot de passe mis à jour' });
      resetForm();
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
          disabled={codeSent}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={codeSent}
        />

        {!codeSent ? (
          <button
            onClick={handleRequestCode}
            disabled={isSending || !newPassword || !confirmPassword}
            className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {isSending ? 'Envoi...' : 'Envoyer le code de vérification'}
          </button>
        ) : (
          <>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900 flex items-start gap-2">
              <Mail size={16} className="shrink-0 mt-0.5" />
              <div>
                Code envoyé à <strong>{profile?.email}</strong>. Vérifiez votre boîte de réception
                (et les spams), puis saisissez le code ci-dessous.
              </div>
            </div>
            <Input
              label="Code de vérification"
              type="text"
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              placeholder="Code à 6 chiffres"
              autoComplete="one-time-code"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmChange}
                disabled={isSaving || !nonce.trim()}
                className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
              </button>
              <button
                onClick={resetForm}
                disabled={isSaving}
                className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </Section>
  );
};
