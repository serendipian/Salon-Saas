import { describe, expect, it } from 'vitest';
import type { Client } from '../../types';
import { toClient, toClientInsert } from './mappers';

// Cast to `any` for fixtures: mappers declare their own narrower Row types.
// Tests exercise the runtime behavior (null handling), not the compile-time shape.
// biome-ignore lint/suspicious/noExplicitAny: test fixture only
const row = (overrides: Record<string, unknown> = {}): any => ({
  id: 'c1',
  salon_id: 's1',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  phone: '+212600000000',
  gender: null,
  age_group: null,
  city: null,
  profession: null,
  company: null,
  notes: null,
  allergies: null,
  status: 'ACTIF',
  preferred_staff_id: null,
  photo_url: null,
  social_network: null,
  social_username: null,
  instagram: null,
  whatsapp: null,
  preferred_channel: null,
  other_channel_detail: null,
  preferred_language: null,
  contact_date: null,
  contact_method: null,
  message_channel: null,
  acquisition_source: null,
  acquisition_detail: null,
  permissions_social_media: false,
  permissions_marketing: false,
  permissions_other: false,
  permissions_other_detail: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
  created_by: null,
  updated_by: null,
  deleted_at: null,
  ...overrides,
});

describe('toClient', () => {
  it('maps required fields', () => {
    const c = toClient(row());
    expect(c.id).toBe('c1');
    expect(c.firstName).toBe('Jane');
    expect(c.lastName).toBe('Doe');
    expect(c.email).toBe('jane@example.com');
    expect(c.status).toBe('ACTIF');
  });

  it('maps null db fields to undefined', () => {
    const c = toClient(row());
    expect(c.gender).toBeUndefined();
    expect(c.ageGroup).toBeUndefined();
    expect(c.preferredStaffId).toBeUndefined();
  });

  it('applies stats when provided', () => {
    const c = toClient(row(), {
      client_id: 'c1',
      salon_id: 's1',
      total_visits: 5,
      total_spent: 1500,
      first_visit_date: '2026-01-15',
      last_visit_date: '2026-04-10',
    });
    expect(c.totalVisits).toBe(5);
    expect(c.totalSpent).toBe(1500);
    expect(c.firstVisitDate).toBe('2026-01-15');
    expect(c.lastVisitDate).toBe('2026-04-10');
  });

  it('defaults stats to zero when absent', () => {
    const c = toClient(row());
    expect(c.totalVisits).toBe(0);
    expect(c.totalSpent).toBe(0);
    expect(c.firstVisitDate).toBeUndefined();
  });
});

describe('toClientInsert', () => {
  const baseClient: Client = {
    id: 'x',
    firstName: 'A',
    lastName: 'B',
    email: '',
    phone: '',
    totalVisits: 0,
    totalSpent: 0,
    createdAt: '',
  };

  it('defaults status to ACTIF when undefined', () => {
    const ins = toClientInsert(baseClient, 's1');
    expect(ins.status).toBe('ACTIF');
  });

  it('preserves non-default status', () => {
    const ins = toClientInsert({ ...baseClient, status: 'VIP' }, 's1');
    expect(ins.status).toBe('VIP');
  });

  it('writes empty string fields as null', () => {
    const ins = toClientInsert(baseClient, 's1');
    expect(ins.email).toBeNull();
    expect(ins.phone).toBeNull();
  });
});
