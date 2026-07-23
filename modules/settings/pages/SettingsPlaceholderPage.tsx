import { Smartphone } from 'lucide-react';
import type React from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';

const sectionTitles: Record<string, string> = {
  locations: 'Lieux',
  payments: 'Paiements',
  notifications: 'Notifications',
  booking: 'Réservation en ligne',
  security: 'Sécurité',
};

export const SettingsPlaceholderPage: React.FC = () => {
  const { section } = useParams<{ section: string }>();
  const title = sectionTitles[section ?? ''] || 'Réglage';

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm p-8 animate-in slide-in-from-right-8">
      <PageHeader title={title} backTo="/settings" backLabel="Retour aux réglages" />
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
