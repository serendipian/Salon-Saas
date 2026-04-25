import { ArrowRight, CheckCircle2, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from './auth/AuthShell';

export const LoginPage: React.FC = () => {
  const {
    signIn,
    signInWithMagicLink,
    isAuthenticated,
    isLoading: authLoading,
    profile,
  } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic'>('password');

  // Sliding-thumb measurement on the toggle pill. We measure with
  // useLayoutEffect (post-mount, before paint) and store in state so the
  // default-selected pill renders with the white thumb on the very first
  // visible frame.
  const passwordBtnRef = useRef<HTMLButtonElement>(null);
  const magicBtnRef = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number }>({ left: 4, width: 0 });
  useLayoutEffect(() => {
    const el = mode === 'password' ? passwordBtnRef.current : magicBtnRef.current;
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [mode]);
  const thumbStyle: React.CSSProperties = { left: thumb.left, width: thumb.width };

  if (!authLoading && isAuthenticated) {
    if (redirect) return <Navigate to={redirect} replace />;
    if (profile === null) return null;
    return <Navigate to={profile.is_admin ? '/admin' : '/dashboard'} replace />;
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) setError(signInError);
    setIsSubmitting(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: linkError } = await signInWithMagicLink(email);
    if (linkError) setError(linkError);
    else setMagicLinkSent(true);
    setIsSubmitting(false);
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span>Pas encore de compte ?</span>
      <Link
        to={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'}
        className="auth-link inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-[var(--auth-ink)]"
      >
        Cr&eacute;er un compte
        <ArrowRight size={14} className="shrink-0" />
      </Link>
    </div>
  );

  return (
    <AuthShell
      kicker="Espace professionnel"
      headline={magicLinkSent ? 'Vérifiez votre boîte mail.' : 'Bon retour.'}
      subhead={
        magicLinkSent
          ? `Un lien sécurisé a été envoyé à ${email}. Ouvrez-le sur cet appareil pour entrer dans votre atelier.`
          : undefined
      }
      footer={magicLinkSent ? null : footer}
    >
      {magicLinkSent ? (
        <div className="space-y-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--auth-ivory-2)] text-[var(--auth-rose-deep)]">
            <CheckCircle2 size={26} strokeWidth={1.5} />
          </div>
          <button
            type="button"
            onClick={() => setMagicLinkSent(false)}
            className="auth-link text-sm font-medium text-[var(--auth-ink)]"
          >
            Renvoyer ou utiliser un autre email
          </button>
        </div>
      ) : (
        <>
          {/* Mode toggle pill */}
          <div className="auth-toggle mb-8">
            <span className="auth-toggle-thumb" style={thumbStyle} />
            <button
              ref={passwordBtnRef}
              type="button"
              data-active={mode === 'password'}
              onClick={() => {
                setMode('password');
                setError(null);
              }}
            >
              Mot de passe
            </button>
            <button
              ref={magicBtnRef}
              type="button"
              data-active={mode === 'magic'}
              onClick={() => {
                setMode('magic');
                setError(null);
              }}
            >
              Lien magique
            </button>
          </div>

          <form
            onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink}
            className="space-y-7"
          >
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

            {mode === 'password' && (
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="auth-label">
                    Mot de passe
                  </label>
                  <Link
                    to="/forgot-password"
                    className="auth-link text-[11px] font-medium tracking-wide text-[var(--auth-ink-soft)]/70"
                  >
                    Oublié ?
                  </Link>
                </div>
                <div className="auth-field">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoComplete="current-password"
                    className="auth-input"
                  />
                  <Lock className="auth-field-icon" size={16} strokeWidth={1.5} />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border-l-2 border-[var(--auth-rose-deep)] bg-[var(--auth-rose-deep)]/[0.04] px-4 py-3 text-sm text-[var(--auth-rose-deep)]">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="auth-cta">
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : mode === 'magic' ? (
                <>
                  <Sparkles size={16} strokeWidth={1.5} />
                  Envoyer le lien
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={16} strokeWidth={1.75} />
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
};
