import { Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  if (!authLoading && isAuthenticated) {
    if (redirect) return <Navigate to={redirect} replace />;
    if (profile === null) return null; // profile still loading — ProtectedRoute will handle final redirect
    return <Navigate to={profile.is_admin ? '/admin' : '/dashboard'} replace />;
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
    }
    setIsSubmitting(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: linkError } = await signInWithMagicLink(email);
    if (linkError) {
      setError(linkError);
    } else {
      setMagicLinkSent(true);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold text-2xl shadow-lg mb-4">
            L
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Lumière Beauty</h1>
          <p className="text-sm text-slate-500 mt-1">Connectez-vous à votre espace</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          {magicLinkSent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <Mail size={24} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Vérifiez votre email</h2>
              <p className="text-sm text-slate-500">
                Un lien de connexion a été envoyé à <strong>{email}</strong>. Cliquez sur le lien
                dans l'email pour vous connecter.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="mt-6 text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Renvoyer ou utiliser un autre email
              </button>
            </div>
          ) : (
            <>
              <div className="flex rounded-xl bg-slate-50 p-1 mb-6">
                <button
                  onClick={() => {
                    setMode('password');
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === 'password'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Mot de passe
                </button>
                <button
                  onClick={() => {
                    setMode('magic');
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === 'magic'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Lien magique
                </button>
              </div>

              <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                    />
                  </div>
                </div>

                {mode === 'password' && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-700">
                        Mot de passe
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        autoComplete="current-password"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : mode === 'magic' ? (
                    <>
                      <Sparkles size={18} />
                      Envoyer le lien magique
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Pas encore de compte ?{' '}
          <Link
            to={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'}
            className="text-slate-900 font-medium hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
};
