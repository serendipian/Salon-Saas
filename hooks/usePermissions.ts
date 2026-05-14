import { useMemo } from 'react';
import type { AccessLevel, AuthAction, AuthResource, Role } from '../lib/auth.types';

export interface PermissionResult {
  can: (action: AuthAction, resource: AuthResource) => boolean;
  accessLevel: (resource: AuthResource) => AccessLevel;
  role: Role | null;
}

export interface RoleOverride {
  role: Role;
  resource: AuthResource;
  action: AuthAction;
  granted: boolean;
}

// Static permission matrix — RLS is the authoritative enforcement layer.
// This hook is for UX only (hiding sidebar items, disabling buttons).
// Per-salon overrides on top of this matrix live in `salon_role_overrides`;
// `buildPermissions` merges them in via the optional `overrides` argument.
const PERMISSIONS: Record<
  Role,
  Record<AuthResource, { actions: AuthAction[]; level: AccessLevel }>
> = {
  owner: {
    dashboard: { actions: ['view', 'view_financials', 'view_past_dates'], level: 'full' },
    appointments: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    clients: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    pos: { actions: ['view', 'create', 'void', 'refund', 'view_history'], level: 'full' },
    services: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    products: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    team: { actions: ['view', 'create', 'edit', 'delete', 'manage'], level: 'full' },
    accounting: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    suppliers: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    settings: { actions: ['view', 'edit'], level: 'full' },
    billing: { actions: ['view', 'manage'], level: 'full' },
    invitations: { actions: ['view', 'create', 'delete'], level: 'full' },
    audit_log: { actions: ['view'], level: 'full' },
  },
  manager: {
    dashboard: { actions: ['view', 'view_financials', 'view_past_dates'], level: 'full' },
    appointments: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    clients: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    pos: { actions: ['view', 'create', 'void', 'refund', 'view_history'], level: 'full' },
    services: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    products: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    team: { actions: ['view', 'create', 'edit', 'delete', 'manage'], level: 'full' },
    accounting: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    suppliers: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    settings: { actions: ['view', 'edit'], level: 'full' },
    billing: { actions: [], level: 'none' },
    invitations: { actions: ['view', 'create', 'delete'], level: 'full' },
    audit_log: { actions: ['view'], level: 'full' },
  },
  stylist: {
    dashboard: { actions: ['view', 'view_financials', 'view_past_dates'], level: 'own' },
    appointments: { actions: ['view'], level: 'own' },
    clients: { actions: ['view'], level: 'linked' },
    pos: { actions: ['view', 'create', 'view_history'], level: 'full' },
    services: { actions: ['view'], level: 'full' },
    products: { actions: ['view'], level: 'full' },
    team: { actions: ['view', 'edit'], level: 'own' },
    accounting: { actions: [], level: 'none' },
    suppliers: { actions: [], level: 'none' },
    settings: { actions: [], level: 'none' },
    billing: { actions: [], level: 'none' },
    invitations: { actions: [], level: 'none' },
    audit_log: { actions: [], level: 'none' },
  },
  receptionist: {
    dashboard: { actions: ['view'], level: 'summary' },
    appointments: { actions: ['view', 'create', 'edit'], level: 'full' },
    clients: { actions: [], level: 'none' },
    pos: { actions: ['view', 'create'], level: 'full' },
    services: { actions: [], level: 'none' },
    products: { actions: [], level: 'none' },
    team: { actions: [], level: 'none' },
    accounting: { actions: [], level: 'none' },
    suppliers: { actions: [], level: 'none' },
    settings: { actions: [], level: 'none' },
    billing: { actions: [], level: 'none' },
    invitations: { actions: [], level: 'none' },
    audit_log: { actions: [], level: 'none' },
  },
};

const EMPTY_OVERRIDES: RoleOverride[] = [];

/**
 * Pure function: derives a {can, accessLevel} API from a role and an optional
 * list of per-salon overrides. Overrides are sparse — only entries that diverge
 * from `PERMISSIONS` are stored — and `granted` flips the default either way.
 *
 * Owner role cannot be overridden (the DB CHECK constraint blocks it too).
 */
export function buildPermissions(
  role: Role | null,
  overrides: RoleOverride[] = EMPTY_OVERRIDES,
): PermissionResult {
  const overrideMap = new Map<string, boolean>();
  for (const o of overrides) {
    if (o.role === 'owner') continue; // safety: owner is not overridable
    overrideMap.set(`${o.role}:${o.resource}:${o.action}`, o.granted);
  }

  return {
    role,
    can: (action: AuthAction, resource: AuthResource): boolean => {
      if (!role) return false;
      if (role !== 'owner') {
        const override = overrideMap.get(`${role}:${resource}:${action}`);
        if (override !== undefined) return override;
      }
      const resourcePerms = PERMISSIONS[role]?.[resource];
      return resourcePerms?.actions.includes(action) ?? false;
    },
    accessLevel: (resource: AuthResource): AccessLevel => {
      if (!role) return 'none';
      return PERMISSIONS[role]?.[resource]?.level ?? 'none';
    },
  };
}

export function usePermissions(
  role: Role | null,
  overrides: RoleOverride[] = EMPTY_OVERRIDES,
): PermissionResult {
  return useMemo(() => buildPermissions(role, overrides), [role, overrides]);
}
