// modules/billing/components/UpgradeModal.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const RESOURCE_COPY = {
  staff: {
    headline: 'Débloquez une équipe illimitée',
    description: 'Passez en Premium pour inviter jusqu\'à 10 membres et gérer votre salon en équipe.',
  },
  clients: {
    headline: 'Débloquez des clients illimités',
    description: 'Passez en Premium pour gérer un nombre illimité de clients.',
  },
  products: {
    headline: 'Débloquez des produits illimités',
    description: 'Passez en Premium pour ajouter autant de produits que vous le souhaitez.',
  },
};

interface UpgradeModalProps {
  resource: 'staff' | 'clients' | 'products';
  priceMonthly: number;
  onUpgrade: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ resource, priceMonthly, onUpgrade, onClose, isLoading }) => {
  const copy = RESOURCE_COPY[resource];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-lg font-extrabold text-slate-900 mb-2 leading-snug">{copy.headline}</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {copy.description}
          </p>
        </div>

        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-5">
          <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2.5">
            Ce que vous débloquez avec Premium
          </div>
          <ul className="space-y-2 text-sm text-slate-800">
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Jusqu'à 10 membres d'équipe
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Clients illimités
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Analytics & rapports avancés
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Branding personnalisé
            </li>
          </ul>
        </div>

        <div className="text-center text-2xl font-extrabold text-slate-900 mb-4">
          {priceMonthly.toFixed(2)} €<span className="text-sm font-normal text-slate-400">/mois</span>
        </div>

        <button
          onClick={onUpgrade}
          disabled={isLoading}
          className="w-full py-3.5 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors text-sm"
        >
          {isLoading ? 'Redirection...' : 'Passer en Premium →'}
        </button>

        <div className="flex justify-center gap-5 mt-4 text-xs text-slate-400">
          <span>✓ Résiliable à tout moment</span>
          <span>🔒 Paiement via Stripe</span>
        </div>
      </div>
    </div>
  );
};
