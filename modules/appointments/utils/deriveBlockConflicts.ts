import type {
  Appointment,
  Service,
  ServiceBlockState,
  StaffMember,
  WorkSchedule,
} from '../../../types';

export type BlockConflict =
  | { kind: 'staff_unavailable'; staffName: string; date: string; hour: number; minute: number }
  | { kind: 'staff_offday'; staffName: string; date: string }
  | { kind: 'sibling_overlap'; staffName: string; otherBlockLabel: string };

const DAY_KEYS: (keyof WorkSchedule)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function staffName(staff: StaffMember): string {
  return staff.lastName ? `${staff.firstName} ${staff.lastName[0]}.` : staff.firstName;
}

function blockDuration(block: ServiceBlockState, services: Service[]): number {
  return block.items.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    const variant = svc?.variants.find((v) => v.id === item.variantId);
    return sum + (variant?.durationMinutes ?? svc?.durationMinutes ?? 0);
  }, 0);
}

function blockLabel(block: ServiceBlockState, services: Service[]): string {
  if (block.items.length === 0) return 'Prestation';
  if (block.items.length > 1) return `${block.items.length} prestations`;
  const svc = services.find((s) => s.id === block.items[0].serviceId);
  return svc?.name ?? 'Prestation';
}

function dayOfWeekKey(date: string): keyof WorkSchedule {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return DAY_KEYS[dow];
}

interface DeriveInput {
  blocks: ServiceBlockState[];
  team: StaffMember[];
  services: Service[];
  existingAppointments: Appointment[];
  excludeAppointmentIds?: string[];
}

export function deriveBlockConflicts(input: DeriveInput): Map<number, BlockConflict> {
  const { blocks, team, services, existingAppointments, excludeAppointmentIds } = input;
  const result = new Map<number, BlockConflict>();
  const excludeSet = new Set(excludeAppointmentIds ?? []);

  // Pre-compute each block's effective time window (only for blocks with staff+date+hour+items).
  type Slot = { staffId: string; date: string; startMin: number; endMin: number };
  const slots: Array<Slot | null> = blocks.map((b) => {
    if (!b.staffId || !b.date || b.hour === null || b.items.length === 0) return null;
    const start = b.hour * 60 + b.minute;
    const end = start + blockDuration(b, services);
    return { staffId: b.staffId, date: b.date, startMin: start, endMin: end };
  });

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const slot = slots[i];
    if (!slot) continue;

    const staff = team.find((m) => m.id === slot.staffId);
    if (!staff) continue;
    const name = staffName(staff);

    // 1. Sibling overlap (highest priority).
    let siblingFound: { otherIndex: number } | null = null;
    for (let j = 0; j < blocks.length; j++) {
      if (j === i) continue;
      const other = slots[j];
      if (!other) continue;
      if (other.staffId !== slot.staffId) continue;
      if (other.date !== slot.date) continue;
      // Half-open intervals [start, end). Touching endpoints don't overlap.
      if (slot.startMin < other.endMin && other.startMin < slot.endMin) {
        siblingFound = { otherIndex: j };
        break;
      }
    }
    if (siblingFound) {
      result.set(i, {
        kind: 'sibling_overlap',
        staffName: name,
        otherBlockLabel: blockLabel(blocks[siblingFound.otherIndex], services),
      });
      continue;
    }

    // 2. Staff off-day.
    const dayKey = dayOfWeekKey(slot.date);
    const daySched = staff.schedule?.[dayKey];
    if (!daySched?.isOpen) {
      result.set(i, { kind: 'staff_offday', staffName: name, date: slot.date });
      continue;
    }

    // 3. DB conflict against existing non-cancelled appointments.
    for (const appt of existingAppointments) {
      if (excludeSet.has(appt.id)) continue;
      if (appt.staffId !== slot.staffId) continue;
      if (appt.status === 'CANCELLED') continue;
      const apptDate = new Date(appt.date);
      const apptLocalDate = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;
      if (apptLocalDate !== slot.date) continue;
      const apptStart = apptDate.getHours() * 60 + apptDate.getMinutes();
      const apptEnd = apptStart + appt.durationMinutes;
      if (slot.startMin < apptEnd && apptStart < slot.endMin) {
        result.set(i, {
          kind: 'staff_unavailable',
          staffName: name,
          date: slot.date,
          hour: block.hour ?? 0,
          minute: block.minute,
        });
        break;
      }
    }
  }

  return result;
}
