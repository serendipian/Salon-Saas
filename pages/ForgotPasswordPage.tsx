import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';

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
    if (resetError) {
      setError(resetError);
    } else {
      setEmailSent(true);
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
          <h1 className="text-2xl font-bold text-slate-900">Mot de passe oublié</h1>
          <p className="text-sm text-slate-500 mt-1">
            Entrez votre email pour recevoir un lien de réinitialisation
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          {emailSent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <Mail size={24} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Email envoyé</h2>
              <p className="text-sm text-slate-500">
                Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un lien
                pour réinitialiser votre mot de passe.
              </p>
              <button
                onClick={() => setEmailSent(false)}
                className="mt-6 text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Renvoyer l'email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
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
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                  />
                </div>
              </div>

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
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Envoyer le lien'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link
            to="/login"
            className="text-slate-900 font-medium hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} />
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
};
