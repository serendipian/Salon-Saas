import { ArrowRight, CheckCircle2, Loader2, Lock, Mail, User } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from './auth/AuthShell';
import { AuthDivider, GoogleSignInButton } from './auth/GoogleSignInButton';

export const SignupPage: React.FC = () => {
  const { signUp, isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  if (!authLoading && isAuthenticated) {
    return <Navigate to={redirect || '/dashboard'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signUpError } = await signUp(email, password, firstName, lastName);
    if (signUpError) setError(signUpError);
    else setSuccess(true);
    setIsSubmitting(false);
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span>Déjà cliente ?</span>
      <Link
        to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
        className="auth-link inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-[var(--auth-ink)]"
      >
        Se connecter
        <ArrowRight size={14} className="shrink-0" />
      </Link>
    </div>
  );

  return (
    <AuthShell
      kicker="Espace professionnel"
      headline={success ? 'Bientôt prête.' : 'Nouveau compte.'}
      subhead={
        success
          ? `Un email de confirmation a été envoyé à ${email}. Activez votre compte pour personnaliser votre salon en quelques minutes.`
          : undefined
      }
      footer={success ? null : footer}
    >
      {success ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--auth-ivory-2)] text-[var(--auth-rose-deep)]">
          <CheckCircle2 size={26} strokeWidth={1.5} />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-2 space-y-5 border-t border-[var(--auth-line)] pt-5 sm:space-y-6"
        >
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="firstName" className="auth-label">
                Prénom
              </label>
              <div className="auth-field">
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Marie"
                  required
                  autoComplete="given-name"
                  className="auth-input"
                />
                <User className="auth-field-icon" size={16} strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <label htmlFor="lastName" className="auth-label">
                Nom
              </label>
              <div className="auth-field">
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  required
                  autoComplete="family-name"
                  className="auth-input no-icon"
                />
              </div>
            </div>
          </div>

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

          <div>
            <label htmlFor="password" className="auth-label">
              Mot de passe
            </label>
            <div className="auth-field">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                required
                minLength={8}
                autoComplete="new-password"
                className="auth-input"
              />
              <Lock className="auth-field-icon" size={16} strokeWidth={1.5} />
            </div>
          </div>

          {error && (
            <div className="rounded-md border-l-2 border-[var(--auth-rose-deep)] bg-[var(--auth-rose-deep)]/[0.04] px-4 py-3 text-sm text-[var(--auth-rose-deep)]">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={isSubmitting || !acceptedTerms}
              className="auth-cta"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Créer mon compte
                  <ArrowRight size={16} strokeWidth={1.75} />
                </>
              )}
            </button>

            <AuthDivider label="ou" />

            <GoogleSignInButton
              redirect={redirect}
              label="S’inscrire avec Google"
              onError={setError}
            />
          </div>

          <label className="auth-terms">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              required
              aria-describedby="terms-text"
            />
            <span className="auth-terms-box" aria-hidden>
              <svg viewBox="0 0 12 10" width="11" height="9" fill="none">
                <path
                  d="M1 5.2L4.2 8.4L11 1.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span id="terms-text" className="auth-terms-text">
              J’accepte les{' '}
              <a
                href="/legal/terms"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--auth-ink)] underline underline-offset-2 decoration-[var(--auth-ink)]/40 hover:decoration-[var(--auth-ink)]"
              >
                Conditions d’Utilisation
              </a>{' '}
              et la{' '}
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--auth-ink)] underline underline-offset-2 decoration-[var(--auth-ink)]/40 hover:decoration-[var(--auth-ink)]"
              >
                Politique de Confidentialité
              </a>
              .
            </span>
          </label>
        </form>
      )}
    </AuthShell>
  );
};
