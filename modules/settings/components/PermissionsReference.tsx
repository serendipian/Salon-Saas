import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X as XIcon } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  appointments: 'Rendez-vous',
  clients: 'Clients',
  pos: 'Caisse',
  services: 'Services',
  products: 'Produits',
  team: 'Équipe',
  accounting: 'Comptabilité',
  suppliers: 'Fournisseurs',
  settings: 'Réglages',
  billing: 'Facturation',
};

const ACCESS_MATRIX: Record<string, Record<string, string>> = {
  dashboard:    { owner: 'Complet', manager: 'Complet', stylist: 'Personnel', receptionist: 'Résumé' },
  appointments: { owner: 'Complet', manager: 'Complet', stylist: 'Personnel', receptionist: 'Complet' },
  clients:      { owner: 'Complet', manager: 'Complet', stylist: 'Assignés', receptionist: 'Complet' },
  pos:          { owner: 'Complet', manager: 'Complet', stylist: 'Complet', receptionist: 'Complet' },
  services:     { owner: 'Complet', manager: 'Complet', stylist: 'Lecture', receptionist: 'Lecture' },
  products:     { owner: 'Complet', manager: 'Complet', stylist: 'Lecture', receptionist: 'Lecture' },
  team:         { owner: 'Complet', manager: 'Complet', stylist: 'Personnel', receptionist: 'Personnel' },
  accounting:   { owner: 'Complet', manager: 'Complet', stylist: '—', receptionist: '—' },
  suppliers:    { owner: 'Complet', manager: 'Complet', stylist: '—', receptionist: '—' },
  settings:     { owner: 'Complet', manager: 'Complet', stylist: '—', receptionist: '—' },
  billing:      { owner: 'Complet', manager: '—', stylist: '—', receptionist: '—' },
};

const roles = ['owner', 'manager', 'stylist', 'receptionist'] as const;

function AccessBadge({ level }: { level: string }) {
  if (level === '—') return <XIcon className="w-4 h-4 text-slate-300 mx-auto" />;
  if (level === 'Complet') return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  return <span className="text-xs text-slate-500">{level}</span>;
}

export const PermissionsReference: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors rounded-xl"
      >
        <span className="font-medium text-sm text-slate-700">Matrice des permissions par rôle</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Module</th>
                {roles.map(r => (
                  <th key={r} className="py-2 px-3 font-medium text-slate-500 text-center">{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <tr key={key} className="border-b border-slate-50">
                  <td className="py-2 pr-4 text-slate-700">{label}</td>
                  {roles.map(r => (
                    <td key={r} className="py-2 px-3 text-center">
                      <AccessBadge level={ACCESS_MATRIX[key]?.[r] || '—'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
