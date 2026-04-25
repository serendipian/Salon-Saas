import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from './auth/AuthShell';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: resetError } = await resetPassword(email);
    if (resetError) setError(resetError);
    else setEmailSent(true);
    setIsSubmitting(false);
  };

  const footer = (
    <Link
      to="/login"
      className="auth-link inline-flex items-center gap-1.5 font-medium text-[var(--auth-ink)]"
    >
      <ArrowLeft size={14} />
      Retour à la connexion
    </Link>
  );

  return (
    <AuthShell
      kicker="Mot de passe oublié"
      headline={emailSent ? 'Vérifiez votre boîte mail.' : 'Réinitialisez votre accès.'}
      subhead={
        emailSent
          ? `Si un compte existe avec ${email}, vous recevrez un lien pour choisir un nouveau mot de passe.`
          : 'Entrez l’adresse email associée à votre compte. Nous vous enverrons un lien sécurisé pour en créer un nouveau.'
      }
      footer={footer}
    >
      {emailSent ? (
        <div className="space-y-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--auth-ivory-2)] text-[var(--auth-rose-deep)]">
            <CheckCircle2 size={26} strokeWidth={1.5} />
          </div>
          <button
            type="button"
            onClick={() => setEmailSent(false)}
            className="auth-link text-sm font-medium text-[var(--auth-ink)]"
          >
            Renvoyer le lien
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-7">
          <div>
            <label htmlFor="email" className="auth-label">
              Adresse email
            </label>
            <div className="auth-field">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
                className="auth-input"
              />
              <Mail className="auth-field-icon" size={16} strokeWidth={1.5} />
            </div>
          </div>

          {error && (
            <div className="rounded-md border-l-2 border-[var(--auth-rose-deep)] bg-[var(--auth-rose-deep)]/[0.04] px-4 py-3 text-sm text-[var(--auth-rose-deep)]">
              {error}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="auth-cta">
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Envoyer le lien
                <ArrowRight size={16} strokeWidth={1.75} />
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
};
