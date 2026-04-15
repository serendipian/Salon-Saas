import { describe, expect, it } from 'vitest';
import type { BonusTier, StaffMember, WorkSchedule } from '../../types';
import { toStaffMember, toStaffMemberInsert } from './mappers';

const schedule: WorkSchedule = {
  monday: { isOpen: true, start: '09:00', end: '18:00' },
  tuesday: { isOpen: true, start: '09:00', end: '18:00' },
  wednesday: { isOpen: true, start: '09:00', end: '18:00' },
  thursday: { isOpen: true, start: '09:00', end: '18:00' },
  friday: { isOpen: true, start: '09:00', end: '18:00' },
  saturday: { isOpen: false, start: '', end: '' },
  sunday: { isOpen: false, start: '', end: '' },
};

const bonusTiers: BonusTier[] = [
  { target: 5000, bonus: 200 },
  { target: 10000, bonus: 500 },
];

const staffComplete: StaffMember = {
  id: 'st1',
  slug: 'jane-doe',
  firstName: 'Jane',
  lastName: 'Doe',
  role: 'Stylist',
  email: 'jane@salon.com',
  phone: '+212600000000',
  color: 'bg-rose-100 text-rose-800',
  skills: ['cat1', 'cat2'],
  active: true,
  startDate: '2026-01-01',
  commissionRate: 20,
  bonusTiers,
  schedule,
};

describe('toStaffMemberInsert', () => {
  it('round-trips bonus tiers as JSONB-compatible array (not null)', () => {
    const ins = toStaffMemberInsert(staffComplete, 's1');
    expect(ins.bonus_tiers).toEqual(bonusTiers);
    expect(ins.bonus_tiers).not.toBeNull();
  });

  it('round-trips schedule as JSONB-compatible object (not null)', () => {
    const ins = toStaffMemberInsert(staffComplete, 's1');
    expect(ins.schedule).toEqual(schedule);
    expect(ins.schedule).not.toBeNull();
  });

  it('writes null for unset bonus tiers / schedule', () => {
    const bare: StaffMember = {
      ...staffComplete,
      bonusTiers: undefined,
      schedule: undefined as unknown as WorkSchedule,
    };
    const ins = toStaffMemberInsert(bare, 's1');
    expect(ins.bonus_tiers).toBeNull();
    expect(ins.schedule).toBeNull();
  });

  it('preserves color as a className string', () => {
    const ins = toStaffMemberInsert(staffComplete, 's1');
    expect(ins.color).toBe('bg-rose-100 text-rose-800');
  });

  it('writes salon_id from argument, not from staff', () => {
    const ins = toStaffMemberInsert(staffComplete, 'different-salon');
    expect(ins.salon_id).toBe('different-salon');
  });
});

describe('toStaffMember', () => {
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  const baseRow = (overrides: Record<string, unknown> = {}): any => ({
    id: 'st1',
    salon_id: 's1',
    slug: 'jane-doe',
    first_name: 'Jane',
    last_name: 'Doe',
    role: 'Stylist',
    email: 'jane@salon.com',
    phone: '+212600000000',
    color: 'bg-rose-100 text-rose-800',
    photo_url: null,
    bio: null,
    skills: ['cat1', 'cat2'],
    active: true,
    membership_id: null,
    start_date: '2026-01-01',
    end_date: null,
    contract_type: null,
    weekly_hours: null,
    commission_rate: 20,
    base_salary: null,
    bonus_tiers: bonusTiers,
    iban: null,
    social_security_number: null,
    birth_date: null,
    address: null,
    emergency_contact_name: null,
    emergency_contact_relation: null,
    emergency_contact_phone: null,
    schedule,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  });

  it('round-trips bonus tiers from DB', () => {
    const st = toStaffMember(baseRow());
    expect(st.bonusTiers).toEqual(bonusTiers);
  });

  it('round-trips schedule from DB', () => {
    const st = toStaffMember(baseRow());
    expect(st.schedule).toEqual(schedule);
  });

  it('maps color as className string (not hex)', () => {
    const st = toStaffMember(baseRow());
    expect(st.color).toBe('bg-rose-100 text-rose-800');
  });
});
