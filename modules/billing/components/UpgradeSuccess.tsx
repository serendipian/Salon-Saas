// modules/billing/components/UpgradeSuccess.tsx
import type React from 'react';
import { useNavigate } from 'react-router-dom';

interface PlanDetails {
  name: string;
  max_staff: number | null;
  max_clients: number | null;
  max_products: number | null;
  features: { analytics: boolean; api_access: boolean; custom_branding: boolean };
}

interface UpgradeSuccessProps {
  plan?: PlanDetails;
  planName?: string;
}

interface Feature {
  emoji: string;
  label: string;
  sub: string;
}

function buildFeatures(plan: PlanDetails): Feature[] {
  const features: Feature[] = [];

  const staffLabel =
    plan.max_staff === null ? 'Membres illimités' : `Équipe jusqu'à ${plan.max_staff} membres`;
  features.push({
    emoji: '👥',
    label: staffLabel,
    sub: "Invitez maintenant depuis l'onglet Équipe",
  });

  const clientLabel =
    plan.max_clients === null ? 'Clients illimités' : `Jusqu'à ${plan.max_clients} clients`;
  features.push({ emoji: '👤', label: clientLabel, sub: 'Gérez toute votre clientèle' });

  if (plan.features?.analytics) {
    features.push({
      emoji: '📊',
      label: 'Analytics activés',
      sub: 'Explorez vos performances depuis le tableau de bord',
    });
  }

  if (plan.features?.custom_branding) {
    features.push({
      emoji: '🎨',
      label: 'Branding personnalisé',
      sub: "Personnalisez l'apparence de votre salon",
    });
  }

  if (plan.features?.api_access) {
    features.push({ emoji: '🔌', label: 'Accès API', sub: 'Intégrez vos outils métier' });
  }

  return features;
}

export const UpgradeSuccess: React.FC<UpgradeSuccessProps> = ({ plan, planName }) => {
  const navigate = useNavigate();
  const displayName = plan?.name ?? planName ?? 'Premium';
  const features = plan ? buildFeatures(plan) : null;

  const handleContinue = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="text-6xl mb-3">🎉</div>
      <div className="text-[10px] font-bold text-brand-500 uppercase tracking-[.2em] mb-3">
        Bienvenue sur {displayName}
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-2 leading-snug">
        Votre salon est maintenant
        <br />
        sur le plan {displayName} !
      </h2>
      <p className="text-sm text-slate-500 mb-7 leading-relaxed">
        Toutes vos fonctionnalités {displayName} sont immédiatement disponibles.
      </p>

      {features && features.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 mb-7 text-left space-y-3">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center text-lg shrink-0">
                {f.emoji}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{f.label}</div>
                <div className="text-xs text-slate-400">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

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
