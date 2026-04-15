// modules/billing/components/PlanCards.tsx
import type React from 'react';
import type { SubscriptionTier } from '../../../lib/auth.types';

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  max_staff: number | null;
  max_clients: number | null;
  max_products: number | null;
  features: { analytics: boolean; api_access: boolean; custom_branding: boolean };
  stripe_price_id_monthly: string | null;
}

interface PlanCardsProps {
  plans: Plan[];
  currentTier: SubscriptionTier;
  onSelectPlan: (planId: string) => void;
  onDowngrade: () => void;
  isLoading: boolean;
}

const TIER_FROM_NAME: Record<string, SubscriptionTier> = {
  Free: 'free',
  Premium: 'premium',
  Pro: 'pro',
};

export const PlanCards: React.FC<PlanCardsProps> = ({
  plans,
  currentTier,
  onSelectPlan,
  onDowngrade,
  isLoading,
}) => {
  if (currentTier === 'past_due') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center">
        <p className="text-sm font-medium text-rose-700 mb-1">Paiement en attente</p>
        <p className="text-xs text-rose-500">
          Mettez à jour votre carte bancaire via le portail Stripe pour retrouver l'accès à votre
          plan.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
        Changer de plan
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const planTier = TIER_FROM_NAME[plan.name] ?? 'free';
          const isCurrent =
            planTier === currentTier || (currentTier === 'trial' && planTier === 'premium');
          const isUpgrade = plan.price_monthly > 0 && !isCurrent;
          // L-low (PlanCards trial→Free button confusing): treat the Free
          // option as a downgrade for trial users too. Without this flag the
          // button used to read "Choisir Free →" which sounded like a positive
          // action even though Free has lower limits than Premium (the trial).
          const isDowngrade = planTier === 'free' && currentTier !== 'free';
          const isTrialToFree = planTier === 'free' && currentTier === 'trial';

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl p-5 border-2 transition-all ${
                isCurrent ? 'border-brand-500' : 'border-slate-200'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full whitespace-nowrap">
                  PLAN ACTUEL
                </div>
              )}

              <div className="font-bold text-slate-900 text-base mb-1">{plan.name}</div>
              <div className="text-3xl font-extrabold text-slate-900 mb-4">
                {plan.price_monthly === 0 ? '0 €' : `${plan.price_monthly.toFixed(2)} €`}
                <span className="text-sm font-normal text-slate-400"> /mois</span>
              </div>

              <ul className="space-y-2 mb-5 text-sm">
                <li className="text-slate-600">
                  ✓{' '}
                  {plan.max_staff === null ? 'Membres illimités' : `${plan.max_staff} membres max`}
                </li>
                <li className="text-slate-600">
                  ✓{' '}
                  {plan.max_clients === null
                    ? 'Clients illimités'
                    : `${plan.max_clients} clients max`}
                </li>
                <li className={plan.features.analytics ? 'text-slate-600' : 'text-slate-300'}>
                  {plan.features.analytics ? '✓' : '✗'} Analytics
                </li>
                <li className={plan.features.custom_branding ? 'text-slate-600' : 'text-slate-300'}>
                  {plan.features.custom_branding ? '✓' : '✗'} Branding personnalisé
                </li>
                {plan.features.api_access && <li className="text-slate-600">✓ Accès API</li>}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-400 cursor-default"
                >
                  Plan actuel
                </button>
              ) : isDowngrade ? (
                <button
                  onClick={onDowngrade}
                  disabled={isLoading}
                  title={
                    isTrialToFree
                      ? 'Le plan Free a moins de fonctionnalités que votre essai Premium'
                      : undefined
                  }
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {isTrialToFree ? 'Passer en Free (limité)' : 'Rétrograder'}
                </button>
              ) : (
                <button
                  onClick={() => onSelectPlan(plan.id)}
                  disabled={isLoading || !plan.stripe_price_id_monthly}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {isLoading
                    ? '...'
                    : isUpgrade
                      ? `Passer en ${plan.name} →`
                      : `Choisir ${plan.name} →`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
