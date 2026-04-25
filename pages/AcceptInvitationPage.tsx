import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { rawRpc } from '../lib/supabaseRaw';

interface InvitationInfo {
  staff_first_name: string | null;
  staff_last_name: string | null;
  staff_email: string | null;
  salon_name: string | null;
  role: string | null;
  is_valid: boolean;
}

export const AcceptInvitationPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user, memberships } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawToken = searchParams.get('token');
  const token =
    rawToken && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawToken)
      ? rawToken
      : null;

  const [status, setStatus] = useState<
    'loading' | 'form' | 'processing' | 'awaiting-memberships' | 'success' | 'error'
  >('loading');
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prevent useEffect from re-triggering accept after signup flow signs in
  const handledBySignup = useRef(false);
  const acceptedRef = useRef(false);

  // Wait for memberships to be loaded after sign-in before showing success
  useEffect(() => {
    if (status !== 'awaiting-memberships') return;

    if (memberships.length > 0) {
      setStatus('success');
      return;
    }

    // Safety timeout: if memberships don't load within 5s, show success anyway
    const timeout = setTimeout(() => setStatus('success'), 5000);
    return () => clearTimeout(timeout);
  }, [status, memberships]);

  // Accept invitation for already-authenticated users (existing accounts)
  const acceptDirectly = useCallback(async () => {
    if (acceptedRef.current) return;
    setStatus('processing');
    try {
      await rawRpc('accept_invitation', { p_token: token! });
      acceptedRef.current = true;
      setStatus('success');
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        message.includes('expired')
          ? 'Cette invitation a expiré. Demandez une nouvelle invitation.'
          : message.includes('already')
            ? 'Vous êtes déjà membre de ce salon.'
            : `Une erreur est survenue: ${message}`,
      );
    }
  }, [token]);

  // Fetch invitation info (works without auth)
  useEffect(() => {
    if (!token || acceptedRef.current) return;

    const fetchInfo = async () => {
      const { data, error } = await supabase.rpc('get_invitation_info', { p_token: token });
      if (error || !data || data.length === 0 || !data[0].is_valid) {
        setStatus('error');
        setErrorMessage(
          'Cette invitation est invalide ou a expiré. Demandez une nouvelle invitation.',
        );
        return;
      }
      setInvitationInfo(data[0]);

      // If user was already authenticated BEFORE this page loaded, accept directly
      if (isAuthenticated && user && !handledBySignup.current) {
        await acceptDirectly();
      } else if (!handledBySignup.current) {
        setStatus('form');
      }
    };

    if (!authLoading) {
      void fetchInfo();
    }
  }, [token, authLoading, isAuthenticated, user, acceptDirectly]);

  // Handle password-only signup for new users
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invitationInfo) return;

    if (password.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    // Mark that signup flow is handling everything — prevent useEffect race
    handledBySignup.current = true;
    setStatus('processing');
    setErrorMessage(null);

    try {
      // Step 1: Edge Function creates user + accepts invitation server-side
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/accept-invitation-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.existing) {
          setStatus('error');
          setErrorMessage(
            "Un compte existe déjà avec cet email. Connectez-vous puis utilisez le lien d'invitation.",
          );
          return;
        }
        setStatus('error');
        setErrorMessage(result.error || 'Erreur lors de la création du compte');
        return;
      }

      // Step 2: Sign in with new credentials (invitation already accepted server-side)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });

      if (signInError) {
        // Account + invitation are done, just can't auto-sign-in
        setStatus('error');
        setErrorMessage(
          'Compte créé avec succès ! Connectez-vous avec votre email et mot de passe.',
        );
        return;
      }

      acceptedRef.current = true;
      // Wait for onAuthStateChange to fetch memberships before showing success
      setStatus('awaiting-memberships');
    } catch {
      setStatus('error');
      setErrorMessage('Une erreur est survenue. Veuillez réessayer.');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f7f2ea]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f2ea] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          {status === 'loading' && (
            <div className="text-center">
              <Loader2 size={40} className="animate-spin text-slate-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">Chargement...</h2>
              <p className="text-sm text-slate-500 mt-1">Vérification de votre invitation</p>
            </div>
          )}

          {status === 'form' && invitationInfo && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Bienvenue chez {invitationInfo.salon_name}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Créez votre mot de passe pour rejoindre l'équipe
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Nom</span>
                  <span className="font-medium text-slate-900">
                    {invitationInfo.staff_first_name} {invitationInfo.staff_last_name}
                  </span>
                </div>
                {invitationInfo.staff_email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Email</span>
                    <span className="font-medium text-slate-900">{invitationInfo.staff_email}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Rôle</span>
                  <span className="font-medium text-slate-900 capitalize">
                    {invitationInfo.role}
                  </span>
                </div>
              </div>

              {!invitationInfo.staff_email ? (
                <div className="text-center py-4">
                  <XCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-700 font-medium">Email manquant</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Demandez au gérant d'ajouter votre email à votre fiche avant d'accepter
                    l'invitation.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrorMessage(null);
                        }}
                        placeholder="Minimum 8 caractères"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all"
                  >
                    Créer mon compte
                  </button>
                </form>
              )}
            </>
          )}

          {(status === 'processing' || status === 'awaiting-memberships') && (
            <div className="text-center">
              <Loader2 size={40} className="animate-spin text-slate-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">Création en cours...</h2>
              <p className="text-sm text-slate-500 mt-1">Configuration de votre compte</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Invitation acceptée !</h2>
              <p className="text-sm text-slate-500 mt-1">Vous avez rejoint le salon avec succès.</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all"
              >
                Continuer
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 text-rose-600 mx-auto mb-4">
                <XCircle size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Erreur</h2>
              <p className="text-sm text-slate-500 mt-1">{errorMessage}</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all"
              >
                Aller à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
