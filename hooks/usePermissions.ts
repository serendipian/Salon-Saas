import { useMemo } from 'react';
import type { AccessLevel, AuthAction, AuthResource, Role } from '../lib/auth.types';

interface PermissionResult {
  can: (action: AuthAction, resource: AuthResource) => boolean;
  accessLevel: (resource: AuthResource) => AccessLevel;
  role: Role | null;
}

// Static permission matrix — RLS is the authoritative enforcement layer.
// This hook is for UX only (hiding sidebar items, disabling buttons).
const PERMISSIONS: Record<
  Role,
  Record<AuthResource, { actions: AuthAction[]; level: AccessLevel }>
> = {
  owner: {
    dashboard: { actions: ['view'], level: 'full' },
    appointments: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    clients: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    pos: { actions: ['view', 'create', 'void', 'refund'], level: 'full' },
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
    dashboard: { actions: ['view'], level: 'full' },
    appointments: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    clients: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    pos: { actions: ['view', 'create', 'void', 'refund'], level: 'full' },
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
    dashboard: { actions: ['view'], level: 'own' },
    appointments: { actions: ['view'], level: 'own' },
    clients: { actions: ['view'], level: 'linked' },
    pos: { actions: ['view', 'create'], level: 'full' },
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
    clients: { actions: ['view', 'create', 'edit'], level: 'full' },
    pos: { actions: ['view', 'create'], level: 'full' },
    services: { actions: ['view'], level: 'full' },
    products: { actions: ['view'], level: 'full' },
    team: { actions: ['view'], level: 'own' },
    accounting: { actions: [], level: 'none' },
    suppliers: { actions: [], level: 'none' },
    settings: { actions: [], level: 'none' },
    billing: { actions: [], level: 'none' },
    invitations: { actions: [], level: 'none' },
    audit_log: { actions: [], level: 'none' },
  },
};

export function usePermissions(role: Role | null): PermissionResult {
  return useMemo(
    () => ({
      role,
      can: (action: AuthAction, resource: AuthResource): boolean => {
        if (!role) return false;
        const resourcePerms = PERMISSIONS[role]?.[resource];
        if (!resourcePerms) return false;
        return resourcePerms.actions.includes(action);
      },
      accessLevel: (resource: AuthResource): AccessLevel => {
        if (!role) return 'none';
        return PERMISSIONS[role]?.[resource]?.level ?? 'none';
      },
    }),
    [role],
  );
}
