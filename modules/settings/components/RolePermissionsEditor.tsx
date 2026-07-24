import { Eye, RotateCcw } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { useAuth } from '../../../context/AuthContext';
import { useRoleOverrides } from '../../../hooks/useRoleOverrides';
import { buildPermissions } from '../../../hooks/usePermissions';
import type { AuthAction, AuthResource } from '../../../lib/auth.types';

const EDITABLE_ROLES = ['manager', 'stylist', 'receptionist'] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];

const ROLE_LABELS: Record<EditableRole, string> = {
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const RESOURCE_LABELS: Record<AuthResource, string> = {
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
  invitations: 'Invitations',
  audit_log: "Journal d'audit",
};

const ACTION_LABELS: Record<AuthAction, string> = {
  view: 'Voir',
  create: 'Créer',
  edit: 'Modifier',
  delete: 'Supprimer',
  manage: 'Gérer',
  void: 'Annuler',
  refund: 'Rembourser',
  view_history: 'Voir l’historique',
  view_financials: 'Voir les indicateurs financiers',
  view_past_dates: 'Voir les dates passées',
};

// Universe of toggles per resource, derived from what owner has access to.
// Roles can only be granted/denied actions that exist for that resource.
const RESOURCE_ACTIONS: Record<AuthResource, AuthAction[]> = {
  dashboard: ['view', 'view_financials', 'view_past_dates'],
  appointments: ['view', 'create', 'edit', 'delete'],
  clients: ['view', 'create', 'edit', 'delete'],
  pos: ['view', 'create', 'void', 'refund', 'view_history'],
  services: ['view', 'create', 'edit', 'delete'],
  products: ['view', 'create', 'edit', 'delete'],
  team: ['view', 'create', 'edit', 'delete', 'manage'],
  accounting: ['view', 'create', 'edit', 'delete'],
  suppliers: ['view', 'create', 'edit', 'delete'],
  settings: ['view', 'edit'],
  billing: ['view', 'manage'],
  invitations: ['view', 'create', 'delete'],
  audit_log: ['view'],
};

const RESOURCE_ORDER: AuthResource[] = [
  'dashboard',
  'appointments',
  'clients',
  'pos',
  'services',
  'products',
  'team',
  'accounting',
  'suppliers',
  'settings',
  'billing',
  'invitations',
  'audit_log',
];

interface PermissionRowProps {
  action: AuthAction;
  defaultGranted: boolean;
  effectiveGranted: boolean;
  isOverridden: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}

const PermissionRow: React.FC<PermissionRowProps> = ({
  action,
  defaultGranted,
  effectiveGranted,
  isOverridden,
  disabled,
  onToggle,
}) => {
  return (
    <label
      className={`flex items-center justify-between gap-3 py-2 px-3 rounded-lg transition-colors ${
        disabled ? 'opacity-50' : 'hover:bg-slate-50 cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="checkbox"
          checked={effectiveGranted}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-accent-500"
        />
        <span className="text-sm text-slate-700 truncate">{ACTION_LABELS[action]}</span>
        {isOverridden && (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            personnalisé
          </span>
        )}
      </div>
      <span className="text-[10px] text-slate-400 shrink-0">
        défaut : {defaultGranted ? 'oui' : 'non'}
      </span>
    </label>
  );
};

export const RolePermissionsEditor: React.FC = () => {
  const { overrides, setOverride, isSettingOverride, resetRole, isResettingRole } =
    useRoleOverrides();
  const { setPreviewRole } = useAuth();
  const [activeRole, setActiveRole] = useState<EditableRole>('receptionist');
  const [pendingResetRole, setPendingResetRole] = useState<EditableRole | null>(null);

  // Default-vs-effective lookup for the active role. Default comes from the static
  // matrix (overrides=[]); effective merges the salon's stored overrides.
  const defaults = useMemo(() => buildPermissions(activeRole, []), [activeRole]);
  const effective = useMemo(
    () => buildPermissions(activeRole, overrides),
    [activeRole, overrides],
  );

  const overrideMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const o of overrides) {
      if (o.role === activeRole) {
        map.set(`${o.resource}:${o.action}`, o.granted);
      }
    }
    return map;
  }, [overrides, activeRole]);

  const overrideCount = overrideMap.size;

  const handleToggle = (resource: AuthResource, action: AuthAction, next: boolean) => {
    const def = defaults.can(action, resource);
    // If the new value matches the default, delete the override row (revert);
    // otherwise upsert the explicit flip. Keeps the table sparse.
    setOverride({
      role: activeRole,
      resource,
      action,
      granted: next === def ? null : next,
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Permissions par rôle</h2>
          <p className="text-sm text-slate-500">
            Personnalisez ce que chaque rôle peut voir et faire dans ce salon. Le rôle Propriétaire
            conserve toujours l'accès complet et ne peut pas être modifié.
          </p>
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {EDITABLE_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActiveRole(r)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeRole === r
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Status + action bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg flex-wrap">
          <div className="text-sm text-slate-600">
            {overrideCount === 0 ? (
              <>Aucune personnalisation — ce rôle utilise les permissions par défaut.</>
            ) : (
              <>
                <span className="font-medium text-slate-900">{overrideCount}</span> permission
                {overrideCount > 1 ? 's' : ''} personnalisée{overrideCount > 1 ? 's' : ''}.
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewRole(activeRole)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors shadow-sm"
            >
              <Eye size={12} />
              Aperçu
            </button>
            <button
              type="button"
              onClick={() => setPendingResetRole(activeRole)}
              disabled={overrideCount === 0 || isResettingRole}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={12} />
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Resource sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RESOURCE_ORDER.map((resource) => {
            const actions = RESOURCE_ACTIONS[resource];
            return (
              <div
                key={resource}
                className="border border-slate-200 rounded-xl bg-white overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-semibold text-sm text-slate-800">
                    {RESOURCE_LABELS[resource]}
                  </h3>
                </div>
                <div className="p-2">
                  {actions.map((action) => {
                    const def = defaults.can(action, resource);
                    const eff = effective.can(action, resource);
                    const isOverridden = overrideMap.has(`${resource}:${action}`);
                    return (
                      <PermissionRow
                        key={action}
                        action={action}
                        defaultGranted={def}
                        effectiveGranted={eff}
                        isOverridden={isOverridden}
                        disabled={isSettingOverride}
                        onToggle={(next) => handleToggle(resource, action, next)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={pendingResetRole !== null}
        title="Réinitialiser les permissions"
        message={`Toutes les permissions personnalisées du rôle ${pendingResetRole ? ROLE_LABELS[pendingResetRole] : ''} seront supprimées. Cette action est irréversible.`}
        confirmLabel="Réinitialiser"
        cancelLabel="Annuler"
        tone="warning"
        isLoading={isResettingRole}
        onConfirm={() => {
          if (pendingResetRole) resetRole(pendingResetRole);
          setPendingResetRole(null);
        }}
        onClose={() => setPendingResetRole(null)}
      />
    </>
  );
};
