import { ArrowRight, CheckCircle2, Loader2, Lock } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { AuthShell } from './auth/AuthShell';

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setChecking(false);
      }
    });

    const timeout = setTimeout(() => {
      setChecking(false);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    if (updateError) {
      setError(updateError);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    }
    setIsSubmitting(false);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf6f1]">
        <Loader2 size={24} className="animate-spin text-[#b34868]" />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <AuthShell
        kicker="Lien expiré"
        headline="Ce lien n’est plus valide."
        subhead="Pour des raisons de sécurité, les liens de réinitialisation expirent rapidement. Demandez-en un nouveau."
      >
        <button
          type="button"
          onClick={() => navigate('/forgot-password', { replace: true })}
          className="auth-cta"
        >
          Demander un nouveau lien
          <ArrowRight size={16} strokeWidth={1.75} />
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Nouveau mot de passe"
      headline={success ? 'Tout est prêt.' : 'Choisissez un mot de passe.'}
      subhead={
        success
          ? 'Votre mot de passe a été mis à jour. Redirection vers votre tableau de bord…'
          : 'Au moins 8 caractères. Mélangez lettres, chiffres et symboles pour plus de sécurité.'
      }
    >
      {success ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--auth-ivory-2)] text-[var(--auth-rose-deep)]">
          <CheckCircle2 size={26} strokeWidth={1.5} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div>
            <label htmlFor="password" className="auth-label">
              Nouveau mot de passe
            </label>
            <div className="auth-field">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                className="auth-input"
              />
              <Lock className="auth-field-icon" size={16} strokeWidth={1.5} />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="auth-label">
              Confirmer
            </label>
            <div className="auth-field">
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                className="auth-input"
              />
              <Lock className="auth-field-icon" size={16} strokeWidth={1.5} />
            </div>
          </div>

          {error && (
            <div className="rounded-sm border-l-2 border-[var(--auth-rose-deep)] bg-[var(--auth-rose-deep)]/[0.04] px-4 py-3 text-sm text-[var(--auth-rose-deep)]">
              {error}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="auth-cta">
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Mettre à jour
                <ArrowRight size={16} strokeWidth={1.75} />
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
};
