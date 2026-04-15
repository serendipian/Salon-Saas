import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Users,
  MapPin,
  Bell,
  CreditCard,
  Shield,
  Globe,
  Calculator,
  ChevronRight,
  Smartphone,
  Clock,
} from 'lucide-react';

const SettingCard = ({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-start gap-4 p-6 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all text-left group h-full w-full"
  >
    <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-slate-100 text-slate-500 group-hover:text-slate-900 transition-colors">
      <Icon size={24} />
    </div>
    <div className="flex-1">
      <h3 className="font-semibold text-slate-900 mb-1 flex items-center justify-between">
        {title}
        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
      </h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  </button>
);

const sections = [
  {
    id: 'billing',
    icon: CreditCard,
    title: 'Abonnement & Facturation',
    description: 'Plan actuel, usage, factures.',
  },
  {
    id: 'general',
    icon: Store,
    title: 'Général',
    description: 'Nom du salon, coordonnées, devise.',
  },
  { id: 'schedule', icon: Clock, title: 'Horaires', description: "Heures d'ouverture du salon." },
  {
    id: 'accounting',
    icon: Calculator,
    title: 'Comptabilité',
    description: 'TVA, catégories, charges fixes.',
  },
  {
    id: 'team',
    icon: Users,
    title: 'Équipe & Permissions',
    description: 'Membres, horaires et accès.',
  },
  { id: 'locations', icon: MapPin, title: 'Lieux', description: 'Salons et salles de soins.' },
  {
    id: 'payments',
    icon: CreditCard,
    title: 'Paiements',
    description: 'Moyens de paiement, taxes.',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Rappels SMS et emails.',
  },
  {
    id: 'booking',
    icon: Globe,
    title: 'Réservation en ligne',
    description: 'Widget et apparence.',
  },
  { id: 'security', icon: Shield, title: 'Sécurité', description: 'Mot de passe et accès.' },
];

export const SettingsIndexPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full pb-10 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Réglages</h1>
        <p className="text-slate-500 mt-1">Gérez les préférences de votre établissement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <SettingCard
            key={section.id}
            icon={section.icon}
            title={section.title}
            description={section.description}
            onClick={() => navigate(section.id)}
          />
        ))}
      </div>

      <div className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Support & Aide</h2>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-900 shadow-sm">
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Besoin d'aide ?</h3>
              <p className="text-slate-500 text-sm">
                Contactez notre support technique dédié 7j/7.
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
            Contacter le support
          </button>
        </div>
      </div>
    </div>
  );
};
