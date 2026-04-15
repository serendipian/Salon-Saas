import { describe, expect, it } from 'vitest';
import { AppointmentStatus } from '../../types';
import { toAppointment, toAppointmentInsert } from './mappers';

describe('toAppointment', () => {
  it('maps joined client/service/variant/staff names', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'a1',
      salon_id: 's1',
      client_id: 'c1',
      service_id: 'sv1',
      service_variant_id: 'v1',
      staff_id: 'st1',
      date: '2026-05-01T10:00:00Z',
      duration_minutes: 60,
      status: 'SCHEDULED',
      price: 300,
      notes: null,
      group_id: null,
      deleted_at: null,
      clients: { first_name: 'Jane', last_name: 'Doe' },
      services: { name: 'Cut' },
      service_variants: { name: 'Short' },
      staff_members: { first_name: 'Anna', last_name: 'S.' },
    };
    const a = toAppointment(row);
    expect(a.id).toBe('a1');
    expect(a.clientName).toBe('Jane Doe');
    expect(a.serviceName).toBe('Cut');
    expect(a.variantName).toBe('Short');
    expect(a.staffName).toBe('Anna S.');
    expect(a.status).toBe(AppointmentStatus.SCHEDULED);
  });

  it('preserves groupId and deletedAt', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'a1',
      salon_id: 's1',
      client_id: 'c1',
      service_id: 'sv1',
      service_variant_id: 'v1',
      staff_id: 'st1',
      date: '2026-05-01T10:00:00Z',
      duration_minutes: 60,
      status: 'SCHEDULED',
      price: 300,
      notes: null,
      group_id: 'g1',
      deleted_at: '2026-04-15T00:00:00Z',
      clients: { first_name: 'A', last_name: 'B' },
      services: { name: 'X' },
      service_variants: { name: 'Y' },
      staff_members: { first_name: 'Z', last_name: 'W' },
    };
    const a = toAppointment(row);
    expect(a.groupId).toBe('g1');
    expect(a.deletedAt).toBe('2026-04-15T00:00:00Z');
  });
});

describe('toAppointmentInsert', () => {
  it('writes salon_id from argument', () => {
    const ins = toAppointmentInsert(
      {
        id: 'a1',
        clientId: 'c1',
        clientName: 'Jane Doe',
        serviceId: 'sv1',
        serviceName: 'Cut',
        variantId: 'v1',
        variantName: 'Short',
        staffId: 'st1',
        staffName: 'Anna S.',
        date: '2026-05-01T10:00:00Z',
        durationMinutes: 60,
        status: AppointmentStatus.SCHEDULED,
        price: 300,
      },
      's1',
    );
    expect(ins.salon_id).toBe('s1');
    expect(ins.status).toBe('SCHEDULED');
    expect(ins.duration_minutes).toBe(60);
  });
});
