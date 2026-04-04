// modules/billing/components/UpgradeSuccess.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface UpgradeSuccessProps {
  planName?: string;
}

export const UpgradeSuccess: React.FC<UpgradeSuccessProps> = ({ planName = 'Premium' }) => {
  const navigate = useNavigate();

  const handleContinue = () => {
    // Remove ?success=true from URL and go to dashboard
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="text-6xl mb-3">🎉</div>
      <div className="text-[10px] font-bold text-brand-500 uppercase tracking-[.2em] mb-3">
        Bienvenue sur {planName}
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-2 leading-snug">
        Votre salon est maintenant<br />sur le plan {planName} !
      </h2>
      <p className="text-sm text-slate-500 mb-7 leading-relaxed">
        Toutes vos fonctionnalités {planName} sont immédiatement disponibles.
      </p>

      <div className="bg-slate-50 rounded-xl p-4 mb-7 text-left space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center text-lg shrink-0">👥</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Équipe jusqu'à 10 membres</div>
            <div className="text-xs text-slate-400">Invitez maintenant depuis l'onglet Équipe</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center text-lg shrink-0">📊</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Analytics activés</div>
            <div className="text-xs text-slate-400">Explorez vos performances depuis le tableau de bord</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full py-3.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
      >
        Continuer vers l'application →
      </button>
      <p className="text-xs text-slate-400 mt-4">Un reçu a été envoyé à votre adresse email</p>
    </div>
  );
};
