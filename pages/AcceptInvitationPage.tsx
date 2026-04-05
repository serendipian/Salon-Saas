import React, { useState, useEffect } from 'react';
import { useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const AcceptInvitationPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawToken = searchParams.get('token');
  // Validate token format (UUID) to prevent injection
  const token = rawToken && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawToken)
    ? rawToken
    : null;

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!user || accepted || !token) return;

    const acceptInvitation = async () => {
      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });

      if (error) {
        setStatus('error');
        setErrorMessage(
          error.message.includes('expired')
            ? "Cette invitation a expiré. Demandez une nouvelle invitation."
            : error.message.includes('already')
            ? "Vous êtes déjà membre de ce salon."
            : "Une erreur est survenue. Veuillez réessayer."
        );
      } else {
        setStatus('success');
        setAccepted(true);
      }
    };

    acceptInvitation();
  }, [user, token, accepted]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnUrl = `/accept-invitation?token=${token}`;
    return <Navigate to={`/signup?redirect=${encodeURIComponent(returnUrl)}`} replace />;
  }

  if (!token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 size={40} className="animate-spin text-slate-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">Acceptation en cours...</h2>
              <p className="text-sm text-slate-500 mt-1">Vérification de votre invitation</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Invitation acceptée !</h2>
              <p className="text-sm text-slate-500 mt-1">Vous avez rejoint le salon avec succès.</p>
              <button
                onClick={() => navigate('/select-salon')}
                className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all"
              >
                Continuer
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 text-rose-600 mx-auto mb-4">
                <XCircle size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Erreur</h2>
              <p className="text-sm text-slate-500 mt-1">{errorMessage}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all"
              >
                Retour à l'accueil
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
