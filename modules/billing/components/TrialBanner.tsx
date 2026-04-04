// modules/billing/components/TrialBanner.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';

interface TrialBannerProps {
  daysLeft: number;
  onUpgradeClick: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ daysLeft, onUpgradeClick }) => (
  <div className="bg-gradient-to-r from-brand-500 to-rose-500 text-white px-6 py-3 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <Sparkles size={16} className="shrink-0" />
      <div>
        <span className="font-semibold text-sm">Essai Premium — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</span>
        <span className="text-white/80 text-sm ml-2 hidden sm:inline">
          Toutes les fonctionnalités Premium gratuitement.
        </span>
      </div>
    </div>
    <button
      onClick={onUpgradeClick}
      className="shrink-0 bg-white text-brand-500 text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
    >
      Choisir un plan →
    </button>
  </div>
);
