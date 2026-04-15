import { ArrowLeft, Smartphone } from 'lucide-react';
import type React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const sectionTitles: Record<string, string> = {
  locations: 'Lieux',
  payments: 'Paiements',
  notifications: 'Notifications',
  booking: 'Réservation en ligne',
  security: 'Sécurité',
};

export const SettingsPlaceholderPage: React.FC = () => {
  const navigate = useNavigate();
  const { section } = useParams<{ section: string }>();
  const title = sectionTitles[section ?? ''] || 'Réglage';

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm p-8 animate-in slide-in-from-right-8">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 w-fit"
      >
        <ArrowLeft size={20} />
        <span className="font-medium text-sm">Retour aux réglages</span>
      </button>
      <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <Smartphone size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">{title}</h2>
        <p className="text-sm">Cette section est en cours de configuration.</p>
      </div>
    </div>
  );
};
