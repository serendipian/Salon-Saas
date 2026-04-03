// modules/billing/components/CurrentPlanCard.tsx
import React from 'react';
import type { Subscription, SubscriptionTier } from '../../../lib/auth.types';
import type { PLAN_LIMITS } from '../hooks/useBilling';

interface UsageBarProps {
  label: string;
  current: number;
  max: number | null;
}

const UsageBar: React.FC<UsageBarProps> = ({ label, current, max }) => {
  const pct = max === null ? 0 : Math.min(100, Math.round((current / max) * 100));
  const isNearLimit = max !== null && pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className={`font-semibold ${isNearLimit ? 'text-rose-600' : 'text-slate-900'}`}>
          {current} / {max === null ? 'illimité' : max}
        </span>
      </div>
      <div className="bg-slate-100 rounded-full h-1.5">
        {max !== null && (
          <div
            className={`h-1.5 rounded-full transition-all ${isNearLimit ? 'bg-rose-500' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  trial: 'Pro (Essai)',
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
  past_due: 'Pro',
};

const TIER_BADGES: Record<SubscriptionTier, { label: string; className: string }> = {
  trial:      { label: 'ESSAI',     className: 'bg-blue-100 text-blue-700' },
  free:       { label: 'FREE',      className: 'bg-slate-100 text-slate-600' },
  pro:        { label: 'PRO',       className: 'bg-brand-100 text-brand-700' },
  enterprise: { label: 'ENTERPRISE',className: 'bg-purple-100 text-purple-700' },
  past_due:   { label: 'IMPAYÉ',    className: 'bg-rose-100 text-rose-700' },
};

interface CurrentPlanCardProps {
  subscription: Subscription | undefined;
  tier: SubscriptionTier;
  limits: typeof PLAN_LIMITS[SubscriptionTier];
  staffCount: number;
  clientCount: number;
  productCount: number;
  onManageBilling: () => void;
  isLoadingPortal: boolean;
}

export const CurrentPlanCard: React.FC<CurrentPlanCardProps> = ({
  subscription, tier, limits, staffCount, clientCount, productCount,
  onManageBilling, isLoadingPortal,
}) => {
  const badge = TIER_BADGES[tier];
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 justify-between">
      <div className="flex-1">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Plan actuel</div>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-2xl font-extrabold text-slate-900">{TIER_LABELS[tier]}</span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        {renewalDate && (
          <div className="text-sm text-slate-500 mb-5">
            {tier === 'trial' ? `Essai jusqu'au` : `Renouvellement le`} {renewalDate}
          </div>
        )}
        <div className="flex flex-col gap-3 max-w-sm">
          <UsageBar label="Membres d'équipe" current={staffCount} max={limits.staff} />
          <UsageBar label="Clients" current={clientCount} max={limits.clients} />
          <UsageBar label="Produits" current={productCount} max={limits.products} />
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
        <button
          onClick={onManageBilling}
          disabled={isLoadingPortal}
          className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isLoadingPortal ? '...' : 'Gérer la facturation ↗'}
        </button>
        <p className="text-xs text-slate-400 text-right">Factures, carte bancaire,<br className="hidden sm:block" /> annulation via Stripe</p>
      </div>
    </div>
  );
};
