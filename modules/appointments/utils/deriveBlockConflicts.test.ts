import { describe, expect, it } from 'vitest';
import type {
  Appointment,
  Service,
  ServiceBlockState,
  StaffMember,
  WorkSchedule,
} from '../../../types';
import { AppointmentStatus } from '../../../types';
import { deriveBlockConflicts } from './deriveBlockConflicts';

const fullDaySchedule: WorkSchedule = {
  monday: { isOpen: true, start: '09:00', end: '20:00' },
  tuesday: { isOpen: true, start: '09:00', end: '20:00' },
  wednesday: { isOpen: true, start: '09:00', end: '20:00' },
  thursday: { isOpen: true, start: '09:00', end: '20:00' },
  friday: { isOpen: true, start: '09:00', end: '20:00' },
  saturday: { isOpen: true, start: '09:00', end: '20:00' },
  sunday: { isOpen: true, start: '09:00', end: '20:00' },
};

const sundayClosedSchedule: WorkSchedule = {
  ...fullDaySchedule,
  sunday: { isOpen: false, start: '09:00', end: '20:00' },
};

const mkStaff = (
  id: string,
  firstName: string,
  schedule: WorkSchedule = fullDaySchedule,
): StaffMember =>
  ({
    id,
    firstName,
    lastName: 'D',
    email: '',
    phone: '',
    role: 'Stylist',
    active: true,
    skills: ['cat-1'],
    color: 'bg-rose-100 text-rose-800',
    schedule,
    startDate: '2024-01-01',
    photoUrl: null,
  }) as unknown as StaffMember;

const mkService = (id: string, durationMinutes: number, categoryId = 'cat-1'): Service =>
  ({
    id,
    name: `Service ${id}`,
    categoryId,
    description: '',
    durationMinutes,
    price: 100,
    variants: [
      {
        id: `${id}-v1`,
        name: '',
        durationMinutes,
        price: 100,
        cost: 0,
        additionalCost: 0,
        isFavorite: false,
        favoriteSortOrder: 0,
      },
    ],
    active: true,
    isFavorite: false,
    favoriteSortOrder: 0,
  }) as Service;

const mkBlock = (overrides: Partial<ServiceBlockState>): ServiceBlockState => ({
  id: overrides.id ?? crypto.randomUUID(),
  categoryId: 'cat-1',
  items: [{ serviceId: 'svc-1', variantId: 'svc-1-v1' }],
  staffId: null,
  date: null,
  hour: null,
  minute: 0,
  ...overrides,
});

const mkExistingAppt = (overrides: Partial<Appointment>): Appointment =>
  ({
    id: 'a1',
    clientId: 'c1',
    clientName: '',
    serviceId: 'svc-x',
    serviceName: '',
    variantId: 'svc-x-v1',
    variantName: '',
    date: '2026-04-27T10:00:00.000',
    durationMinutes: 60,
    staffId: 'st-1',
    staffName: '',
    status: AppointmentStatus.SCHEDULED,
    price: 100,
    groupId: null,
    ...overrides,
  }) as Appointment;

const services: Service[] = [mkService('svc-1', 60), mkService('svc-2', 30)];

describe('deriveBlockConflicts', () => {
  const staff1 = mkStaff('st-1', 'Marie');
  const team = [staff1, mkStaff('st-2', 'Sara')];

  it('returns empty map when no blocks have staff+date+hour', () => {
    const blocks = [mkBlock({ staffId: null })];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('flags staff_offday when staff does not work that day', () => {
    const sundayStaff = mkStaff('st-3', 'Lina', sundayClosedSchedule);
    // 2026-04-26 is a Sunday
    const blocks = [mkBlock({ staffId: 'st-3', date: '2026-04-26', hour: 10 })];
    const result = deriveBlockConflicts({
      blocks,
      team: [sundayStaff],
      services,
      existingAppointments: [],
    });
    expect(result.get(0)?.kind).toBe('staff_offday');
    if (result.get(0)?.kind === 'staff_offday') {
      expect((result.get(0) as { staffName: string }).staffName).toBe('Lina D.');
    }
  });

  it('flags staff_unavailable when slot overlaps an existing appointment', () => {
    const blocks = [mkBlock({ staffId: 'st-1', date: '2026-04-27', hour: 10 })];
    const existing = [
      mkExistingAppt({
        id: 'a-existing',
        staffId: 'st-1',
        date: '2026-04-27T10:30:00.000',
        durationMinutes: 60,
      }),
    ];
    const result = deriveBlockConflicts({
      blocks,
      team,
      services,
      existingAppointments: existing,
    });
    expect(result.get(0)?.kind).toBe('staff_unavailable');
  });

  it('honors excludeAppointmentIds (edit mode)', () => {
    const blocks = [mkBlock({ staffId: 'st-1', date: '2026-04-27', hour: 10 })];
    const existing = [
      mkExistingAppt({
        id: 'a-edited',
        staffId: 'st-1',
        date: '2026-04-27T10:00:00.000',
        durationMinutes: 60,
      }),
    ];
    const result = deriveBlockConflicts({
      blocks,
      team,
      services,
      existingAppointments: existing,
      excludeAppointmentIds: ['a-edited'],
    });
    expect(result.size).toBe(0);
  });

  it('flags sibling_overlap when two blocks share staff at exact same minute', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.get(0)?.kind).toBe('sibling_overlap');
    expect(result.get(1)?.kind).toBe('sibling_overlap');
  });

  it('flags sibling_overlap on partial time overlap', () => {
    // svc-1 = 60min. b1 at 10:00-11:00, b2 at 10:30-11:30
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10, minute: 0 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 10, minute: 30 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.get(0)?.kind).toBe('sibling_overlap');
    expect(result.get(1)?.kind).toBe('sibling_overlap');
  });

  it('does NOT flag sibling_overlap for contiguous-not-overlapping blocks (back-to-back)', () => {
    // b1 = 10:00-11:00, b2 = 11:00-12:00, same staff, different end/start touching
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10, minute: 0 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 11, minute: 0 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('does NOT flag sibling_overlap when staff differ', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-2', date: '2026-04-27', hour: 10 }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('skips blocks without staffId, date, or hour', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: null, date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: null, hour: 10 }),
      mkBlock({ id: 'b3', staffId: 'st-1', date: '2026-04-27', hour: null }),
    ];
    const result = deriveBlockConflicts({ blocks, team, services, existingAppointments: [] });
    expect(result.size).toBe(0);
  });

  it('prioritizes sibling_overlap over staff_unavailable when both apply', () => {
    const blocks = [
      mkBlock({ id: 'b1', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
      mkBlock({ id: 'b2', staffId: 'st-1', date: '2026-04-27', hour: 10 }),
    ];
    const existing = [
      mkExistingAppt({
        id: 'a-existing',
        staffId: 'st-1',
        date: '2026-04-27T10:00:00.000',
        durationMinutes: 60,
      }),
    ];
    const result = deriveBlockConflicts({
      blocks,
      team,
      services,
      existingAppointments: existing,
    });
    expect(result.get(0)?.kind).toBe('sibling_overlap');
  });
});
