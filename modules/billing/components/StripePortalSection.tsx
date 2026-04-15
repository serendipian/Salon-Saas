// modules/billing/components/StripePortalSection.tsx

import { CreditCard } from 'lucide-react';
import type React from 'react';

interface StripePortalSectionProps {
  onOpenPortal: () => void;
  isLoading: boolean;
}

export const StripePortalSection: React.FC<StripePortalSectionProps> = ({
  onOpenPortal,
  isLoading,
}) => (
  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
      <CreditCard size={18} className="text-slate-600" />
    </div>
    <div className="flex-1">
      <div className="text-sm font-semibold text-slate-900">Facturation sécurisée via Stripe</div>
      <div className="text-xs text-slate-500 mt-0.5">
        Téléchargez vos factures, modifiez votre carte bancaire ou annulez depuis le portail Stripe.
      </div>
    </div>
    <button
      onClick={onOpenPortal}
      disabled={isLoading}
      className="shrink-0 border border-slate-300 bg-white text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
    >
      {isLoading ? '...' : 'Ouvrir le portail →'}
    </button>
  </div>
);
