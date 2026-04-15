import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Role } from '../lib/auth.types';
import { usePermissions } from './usePermissions';

const rolesOf = (role: Role | null) => renderHook(() => usePermissions(role)).result.current;

describe('usePermissions — owner', () => {
  const { can, accessLevel } = rolesOf('owner');

  it('can view every resource', () => {
    for (const r of [
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
    ] as const) {
      expect(can('view', r)).toBe(true);
    }
  });

  it('can manage billing', () => {
    expect(can('manage', 'billing')).toBe(true);
  });

  it('can void/refund POS', () => {
    expect(can('void', 'pos')).toBe(true);
    expect(can('refund', 'pos')).toBe(true);
  });

  it('has full access on core resources', () => {
    expect(accessLevel('appointments')).toBe('full');
    expect(accessLevel('clients')).toBe('full');
    expect(accessLevel('team')).toBe('full');
  });
});

describe('usePermissions — manager', () => {
  const { can } = rolesOf('manager');

  it('cannot access billing (owner-only)', () => {
    expect(can('view', 'billing')).toBe(false);
    expect(can('manage', 'billing')).toBe(false);
  });

  it('can do everything else owner can', () => {
    expect(can('create', 'appointments')).toBe(true);
    expect(can('delete', 'clients')).toBe(true);
    expect(can('void', 'pos')).toBe(true);
    expect(can('manage', 'team')).toBe(true);
  });
});

describe('usePermissions — stylist', () => {
  const { can, accessLevel } = rolesOf('stylist');

  it('can view own appointments + dashboard', () => {
    expect(can('view', 'appointments')).toBe(true);
    expect(can('view', 'dashboard')).toBe(true);
    expect(accessLevel('appointments')).toBe('own');
    expect(accessLevel('dashboard')).toBe('own');
  });

  it('can create POS transactions but not void/refund', () => {
    expect(can('create', 'pos')).toBe(true);
    expect(can('void', 'pos')).toBe(false);
    expect(can('refund', 'pos')).toBe(false);
  });

  it('cannot access accounting, suppliers, settings, billing', () => {
    expect(can('view', 'accounting')).toBe(false);
    expect(can('view', 'suppliers')).toBe(false);
    expect(can('view', 'settings')).toBe(false);
    expect(can('view', 'billing')).toBe(false);
  });

  it('has linked access to clients', () => {
    expect(accessLevel('clients')).toBe('linked');
  });
});

describe('usePermissions — receptionist', () => {
  const { can, accessLevel } = rolesOf('receptionist');

  it('can manage appointments and clients fully', () => {
    expect(can('create', 'appointments')).toBe(true);
    expect(can('edit', 'appointments')).toBe(true);
    expect(can('create', 'clients')).toBe(true);
    expect(accessLevel('appointments')).toBe('full');
    expect(accessLevel('clients')).toBe('full');
  });

  it('cannot delete anything', () => {
    expect(can('delete', 'appointments')).toBe(false);
    expect(can('delete', 'clients')).toBe(false);
  });

  it('has summary-level dashboard access', () => {
    expect(accessLevel('dashboard')).toBe('summary');
  });
});

describe('usePermissions — no role', () => {
  const { can, accessLevel } = rolesOf(null);

  it('denies everything', () => {
    expect(can('view', 'dashboard')).toBe(false);
    expect(can('create', 'appointments')).toBe(false);
    expect(accessLevel('clients')).toBe('none');
  });
});
