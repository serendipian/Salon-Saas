import type { StaffMember, WorkSchedule, BonusTier } from '../../types';

interface StaffMemberRow {
  id: string;
  salon_id: string;
  membership_id: string | null;
  first_name: string;
  last_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  color: string | null;
  photo_url: string | null;
  bio: string | null;
  skills: string[] | null;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  contract_type: string | null;
  weekly_hours: number | null;
  commission_rate: number;
  base_salary: number | null;
  bonus_tiers: BonusTier[] | null;
  iban: string | null;
  social_security_number: string | null;
  birth_date: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  schedule: WorkSchedule | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

export function toStaffMember(row: StaffMemberRow): StaffMember {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    role: (row.role as StaffMember['role']) ?? 'Stylist',
    email: row.email ?? '',
    phone: row.phone ?? '',
    color: row.color ?? 'bg-slate-200',
    photoUrl: row.photo_url ?? undefined,
    bio: row.bio ?? undefined,
    skills: row.skills ?? [],
    active: row.active,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? undefined,
    contractType: (row.contract_type as StaffMember['contractType']) ?? undefined,
    weeklyHours: row.weekly_hours ?? undefined,
    commissionRate: row.commission_rate,
    baseSalary: row.base_salary ?? undefined,
    bonusTiers: row.bonus_tiers ?? undefined,
    iban: row.iban ?? undefined,
    socialSecurityNumber: row.social_security_number ?? undefined,
    birthDate: row.birth_date ?? undefined,
    address: row.address ?? undefined,
    emergencyContactName: row.emergency_contact_name ?? undefined,
    emergencyContactRelation: row.emergency_contact_relation ?? undefined,
    emergencyContactPhone: row.emergency_contact_phone ?? undefined,
    schedule: row.schedule ?? {
      monday: { isOpen: true, start: '09:00', end: '19:00' },
      tuesday: { isOpen: true, start: '09:00', end: '19:00' },
      wednesday: { isOpen: true, start: '09:00', end: '19:00' },
      thursday: { isOpen: true, start: '09:00', end: '19:00' },
      friday: { isOpen: true, start: '09:00', end: '19:00' },
      saturday: { isOpen: true, start: '10:00', end: '18:00' },
      sunday: { isOpen: false, start: '09:00', end: '18:00' },
    },
  };
}

export function toStaffMemberInsert(staff: StaffMember, salonId: string) {
  return {
    id: staff.id || undefined,
    salon_id: salonId,
    first_name: staff.firstName,
    last_name: staff.lastName,
    role: staff.role,
    email: staff.email || null,
    phone: staff.phone || null,
    color: staff.color || null,
    photo_url: staff.photoUrl ?? null,
    bio: staff.bio ?? null,
    skills: staff.skills.length > 0 ? staff.skills : null,
    active: staff.active,
    start_date: staff.startDate || null,
    end_date: staff.endDate ?? null,
    contract_type: staff.contractType ?? null,
    weekly_hours: staff.weeklyHours ?? null,
    commission_rate: staff.commissionRate,
    base_salary: staff.baseSalary ?? null,
    bonus_tiers: staff.bonusTiers ?? null,
    iban: staff.iban ?? null,
    social_security_number: staff.socialSecurityNumber ?? null,
    birth_date: staff.birthDate ?? null,
    address: staff.address ?? null,
    emergency_contact_name: staff.emergencyContactName ?? null,
    emergency_contact_relation: staff.emergencyContactRelation ?? null,
    emergency_contact_phone: staff.emergencyContactPhone ?? null,
    schedule: staff.schedule ?? null,
  };
}
