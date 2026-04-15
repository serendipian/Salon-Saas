import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Check, Minus } from 'lucide-react';

const ROLES = ['owner', 'manager', 'stylist', 'receptionist'] as const;

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprio.',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réception.',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'Voir',
  create: 'Créer',
  edit: 'Modifier',
  delete: 'Supprimer',
  manage: 'Gérer',
};

// Scope annotations — shown instead of a checkmark when access is restricted
const SCOPE_NOTES: Record<string, Record<string, string>> = {
  dashboard: { stylist: 'Ses stats', receptionist: 'Résumé' },
  appointments: { stylist: 'Ses rdv' },
  clients: { stylist: 'Assignés' },
  team: { stylist: 'Son profil', receptionist: 'Son profil' },
};

interface ModulePermissions {
  key: string;
  label: string;
  actions: string[];
  access: Record<string, { allowed: boolean; scope?: string }[]>;
}

// Actual permissions verified against UI implementation (2026-04-08 audit)
const MODULES: ModulePermissions[] = [
  {
    key: 'dashboard',
    label: 'Tableau de bord',
    actions: ['view'],
    access: {
      owner: [{ allowed: true }],
      manager: [{ allowed: true }],
      stylist: [{ allowed: true, scope: 'Ses stats' }],
      receptionist: [{ allowed: true, scope: 'Résumé' }],
    },
  },
  {
    key: 'appointments',
    label: 'Rendez-vous',
    actions: ['view', 'create', 'edit', 'delete'],
    access: {
      owner: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      stylist: [
        { allowed: true, scope: 'Ses rdv' },
        { allowed: false },
        { allowed: false },
        { allowed: false },
      ],
      receptionist: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: false }],
    },
  },
  {
    key: 'clients',
    label: 'Clients',
    actions: ['view', 'create', 'edit', 'delete'],
    access: {
      owner: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      stylist: [
        { allowed: true, scope: 'Assignés' },
        { allowed: false },
        { allowed: false },
        { allowed: false },
      ],
      receptionist: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: false }],
    },
  },
  {
    key: 'pos',
    label: 'Caisse',
    actions: ['view', 'create'],
    access: {
      owner: [{ allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }],
      stylist: [{ allowed: true }, { allowed: true }],
      receptionist: [{ allowed: true }, { allowed: true }],
    },
  },
  {
    key: 'services',
    label: 'Services',
    actions: ['view', 'create', 'edit', 'delete'],
    access: {
      owner: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      stylist: [{ allowed: true }, { allowed: false }, { allowed: false }, { allowed: false }],
      receptionist: [{ allowed: true }, { allowed: false }, { allowed: false }, { allowed: false }],
    },
  },
  {
    key: 'products',
    label: 'Produits',
    actions: ['view', 'create', 'edit', 'delete'],
    access: {
      owner: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      stylist: [{ allowed: true }, { allowed: false }, { allowed: false }, { allowed: false }],
      receptionist: [{ allowed: true }, { allowed: false }, { allowed: false }, { allowed: false }],
    },
  },
  {
    key: 'team',
    label: 'Équipe',
    actions: ['view', 'create', 'edit', 'manage'],
    access: {
      owner: [
        { allowed: true },
        { allowed: true },
        { allowed: true },
        { allowed: true, scope: 'Rôles & invitations' },
      ],
      manager: [
        { allowed: true },
        { allowed: true },
        { allowed: true },
        { allowed: true, scope: 'Rôles & invitations' },
      ],
      stylist: [
        { allowed: true, scope: 'Son profil' },
        { allowed: false },
        { allowed: true, scope: 'Son profil' },
        { allowed: false },
      ],
      receptionist: [
        { allowed: true, scope: 'Son profil' },
        { allowed: false },
        { allowed: false },
        { allowed: false },
      ],
    },
  },
  {
    key: 'accounting',
    label: 'Comptabilité',
    actions: ['view', 'create', 'edit', 'delete'],
    access: {
      owner: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      stylist: [{ allowed: false }, { allowed: false }, { allowed: false }, { allowed: false }],
      receptionist: [
        { allowed: false },
        { allowed: false },
        { allowed: false },
        { allowed: false },
      ],
    },
  },
  {
    key: 'suppliers',
    label: 'Fournisseurs',
    actions: ['view', 'create', 'edit', 'delete'],
    access: {
      owner: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }, { allowed: true }, { allowed: true }],
      stylist: [{ allowed: false }, { allowed: false }, { allowed: false }, { allowed: false }],
      receptionist: [
        { allowed: false },
        { allowed: false },
        { allowed: false },
        { allowed: false },
      ],
    },
  },
  {
    key: 'settings',
    label: 'Réglages',
    actions: ['view', 'edit'],
    access: {
      owner: [{ allowed: true }, { allowed: true }],
      manager: [{ allowed: true }, { allowed: true }],
      stylist: [{ allowed: false }, { allowed: false }],
      receptionist: [{ allowed: false }, { allowed: false }],
    },
  },
  {
    key: 'billing',
    label: 'Facturation',
    actions: ['view', 'manage'],
    access: {
      owner: [{ allowed: true }, { allowed: true, scope: 'Abonnement' }],
      manager: [{ allowed: false }, { allowed: false }],
      stylist: [{ allowed: false }, { allowed: false }],
      receptionist: [{ allowed: false }, { allowed: false }],
    },
  },
];

function CellContent({ entry }: { entry: { allowed: boolean; scope?: string } }) {
  if (!entry.allowed) return <Minus className="w-3.5 h-3.5 text-slate-300 mx-auto" />;
  if (entry.scope)
    return <span className="text-[11px] text-amber-600 font-medium">{entry.scope}</span>;
  return <Check className="w-3.5 h-3.5 text-emerald-500 mx-auto" />;
}

function ModuleSummary({ mod }: { mod: ModulePermissions }) {
  // Count allowed actions per role for the collapsed summary
  return (
    <>
      {ROLES.map((role) => {
        const entries = mod.access[role];
        const allowed = entries.filter((e) => e.allowed).length;
        const total = entries.length;
        const hasScope = entries.some((e) => e.scope);

        if (allowed === 0)
          return (
            <td key={role} className="py-2.5 px-2 text-center">
              <Minus className="w-3.5 h-3.5 text-slate-300 mx-auto" />
            </td>
          );
        if (allowed === total && !hasScope)
          return (
            <td key={role} className="py-2.5 px-2 text-center">
              <Check className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
            </td>
          );
        return (
          <td key={role} className="py-2.5 px-2 text-center">
            <span className="text-[11px] font-medium text-amber-600">
              {allowed}/{total}
            </span>
          </td>
        );
      })}
    </>
  );
}

function ModuleGroup({ mod }: { mod: ModulePermissions }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Module header row — clickable to expand */}
      <tr
        onClick={() => setExpanded(!expanded)}
        className="border-b border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="text-sm font-medium text-slate-800">{mod.label}</span>
          </div>
        </td>
        <ModuleSummary mod={mod} />
      </tr>

      {/* Expanded action rows */}
      {expanded &&
        mod.actions.map((action, i) => (
          <tr key={action} className="border-b border-slate-50 bg-slate-50/30">
            <td className="py-2 pr-3 pl-7">
              <span className="text-xs text-slate-500">{ACTION_LABELS[action] || action}</span>
            </td>
            {ROLES.map((role) => (
              <td key={role} className="py-2 px-2 text-center">
                <CellContent entry={mod.access[role][i]} />
              </td>
            ))}
          </tr>
        ))}
    </>
  );
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
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                  Module
                </th>
                {ROLES.map((r) => (
                  <th
                    key={r}
                    className="py-2 px-2 font-medium text-slate-500 text-center text-xs uppercase tracking-wide"
                  >
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod) => (
                <ModuleGroup key={mod.key} mod={mod} />
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" /> Accès complet
            </span>
            <span className="flex items-center gap-1">
              <Minus className="w-3 h-3 text-slate-300" /> Pas d'accès
            </span>
            <span className="text-amber-600 font-medium">Texte</span>
            <span>= accès restreint</span>
          </p>
        </div>
      )}
    </div>
  );
};
