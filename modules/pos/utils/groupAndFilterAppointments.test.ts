import { describe, expect, it } from 'vitest';
import type { Appointment, Service } from '../../../types';
import { AppointmentStatus } from '../../../types';
import {
  type AppointmentFilters,
  filterAppointmentGroups,
  groupAppointments,
} from './groupAndFilterAppointments';

const mkAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: overrides.id ?? 'a1',
  clientId: 'c1',
  clientName: 'Jane Doe',
  serviceId: overrides.serviceId ?? 'sv1',
  serviceName: 'Cut',
  date: overrides.date ?? '2026-04-24T10:00:00.000Z',
  durationMinutes: 60,
  staffId: overrides.staffId ?? 'st1',
  staffName: 'Anna',
  status: overrides.status ?? AppointmentStatus.SCHEDULED,
  variantId: 'v1',
  variantName: 'Short',
  price: 100,
  groupId: overrides.groupId ?? null,
  ...overrides,
});

const mkService = (id: string, categoryId: string): Service =>
  ({
    id,
    name: `Service ${id}`,
    categoryId,
    description: '',
    variants: [],
    active: true,
    isFavorite: false,
    favoriteSortOrder: 0,
  }) as Service;

const noFilters: AppointmentFilters = {
  staffId: 'ALL',
  categoryId: 'ALL',
  status: 'ALL',
};

describe('groupAppointments', () => {
  it('returns an empty array when given no appointments', () => {
    expect(groupAppointments([])).toEqual([]);
  });

  it('groups appointments sharing a groupId into one group', () => {
    const a1 = mkAppt({ id: 'a1', groupId: 'g1' });
    const a2 = mkAppt({ id: 'a2', groupId: 'g1', serviceId: 'sv2' });
    const groups = groupAppointments([a1, a2]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('treats appointments with null groupId as standalone groups', () => {
    const a1 = mkAppt({ id: 'a1', groupId: null });
    const a2 = mkAppt({ id: 'a2', groupId: null });
    const groups = groupAppointments([a1, a2]);
    expect(groups).toHaveLength(2);
  });

  it('preserves input order of groups (by first appearance)', () => {
    const a1 = mkAppt({ id: 'a1', groupId: 'g2' });
    const a2 = mkAppt({ id: 'a2', groupId: 'g1' });
    const a3 = mkAppt({ id: 'a3', groupId: 'g2' });
    const groups = groupAppointments([a1, a2, a3]);
    expect(groups[0][0].id).toBe('a1');
    expect(groups[1][0].id).toBe('a2');
  });
});

describe('filterAppointmentGroups', () => {
  const services = [mkService('sv1', 'cat-hair'), mkService('sv2', 'cat-color')];

  it('returns all groups when all filters are ALL', () => {
    const groups = [[mkAppt()], [mkAppt({ id: 'a2' })]];
    expect(filterAppointmentGroups(groups, noFilters, services)).toEqual(groups);
  });

  it('filters by staffId — keeps groups where any appointment matches', () => {
    const groups = [
      [mkAppt({ id: 'a1', staffId: 'st1' })],
      [mkAppt({ id: 'a2', staffId: 'st2' })],
    ];
    const result = filterAppointmentGroups(groups, { ...noFilters, staffId: 'st1' }, services);
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a1');
  });

  it('filters by staffId — keeps multi-staff group if any member matches', () => {
    const group = [
      mkAppt({ id: 'a1', staffId: 'st1', groupId: 'g1' }),
      mkAppt({ id: 'a2', staffId: 'st2', groupId: 'g1' }),
    ];
    const result = filterAppointmentGroups([group], { ...noFilters, staffId: 'st2' }, services);
    expect(result).toHaveLength(1);
  });

  it('filters by categoryId — resolves via service lookup', () => {
    const groups = [
      [mkAppt({ id: 'a1', serviceId: 'sv1' })],
      [mkAppt({ id: 'a2', serviceId: 'sv2' })],
    ];
    const result = filterAppointmentGroups(
      groups,
      { ...noFilters, categoryId: 'cat-color' },
      services,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a2');
  });

  it('filters by categoryId — excludes appointment with orphaned serviceId', () => {
    const groups = [[mkAppt({ id: 'a1', serviceId: 'missing-service' })]];
    const result = filterAppointmentGroups(
      groups,
      { ...noFilters, categoryId: 'cat-hair' },
      services,
    );
    expect(result).toHaveLength(0);
  });

  it('filters by status', () => {
    const groups = [
      [mkAppt({ id: 'a1', status: AppointmentStatus.SCHEDULED })],
      [mkAppt({ id: 'a2', status: AppointmentStatus.IN_PROGRESS })],
    ];
    const result = filterAppointmentGroups(
      groups,
      { ...noFilters, status: AppointmentStatus.IN_PROGRESS },
      services,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a2');
  });

  it('combines all three filters with AND semantics', () => {
    const groups = [
      [
        mkAppt({
          id: 'a1',
          staffId: 'st1',
          serviceId: 'sv1',
          status: AppointmentStatus.SCHEDULED,
        }),
      ],
      [
        mkAppt({
          id: 'a2',
          staffId: 'st1',
          serviceId: 'sv1',
          status: AppointmentStatus.IN_PROGRESS,
        }),
      ],
      [
        mkAppt({
          id: 'a3',
          staffId: 'st2',
          serviceId: 'sv1',
          status: AppointmentStatus.SCHEDULED,
        }),
      ],
    ];
    const result = filterAppointmentGroups(
      groups,
      {
        staffId: 'st1',
        categoryId: 'cat-hair',
        status: AppointmentStatus.SCHEDULED,
      },
      services,
    );
    expect(result).toHaveLength(1);
    expect(result[0][0].id).toBe('a1');
  });
});
