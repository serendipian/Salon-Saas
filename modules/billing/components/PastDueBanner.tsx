// modules/billing/components/PastDueBanner.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface PastDueBannerProps {
  onFixClick: () => void;
  isLoading?: boolean;
}

export const PastDueBanner: React.FC<PastDueBannerProps> = ({ onFixClick, isLoading }) => (
  <div className="bg-rose-600 text-white px-6 py-3 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <AlertTriangle size={16} className="shrink-0" />
      <span className="text-sm font-medium">
        Votre paiement a échoué. Mettez à jour votre carte bancaire pour conserver votre accès Pro.
      </span>
    </div>
    <button
      onClick={onFixClick}
      disabled={isLoading}
      className="shrink-0 bg-white text-rose-600 text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-white/90 disabled:opacity-50 transition-colors"
    >
      {isLoading ? '...' : 'Mettre à jour →'}
    </button>
  </div>
);
