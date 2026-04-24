import { describe, expect, it } from 'vitest';
import type { Appointment, CartItem } from '../../../types';
import { AppointmentStatus } from '../../../types';
import { diffAppointmentsFromCart } from './diffAppointmentsFromCart';

const mkAppt = (o: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  clientId: 'c1',
  clientName: '',
  serviceId: 'sv1',
  serviceName: '',
  date: '2026-04-24T10:00:00.000Z',
  durationMinutes: 60,
  staffId: 'st1',
  staffName: 'Anna',
  status: AppointmentStatus.SCHEDULED,
  variantId: 'v1',
  variantName: '',
  price: 100,
  groupId: null,
  ...o,
});

const mkItem = (o: Partial<CartItem> = {}): CartItem => ({
  id: 'ci1',
  referenceId: 'v1',
  type: 'SERVICE',
  name: 'Cut',
  price: 100,
  originalPrice: 100,
  quantity: 1,
  staffId: 'st1',
  ...o,
});

describe('diffAppointmentsFromCart', () => {
  it('returns empty when no cart items have appointmentId', () => {
    expect(diffAppointmentsFromCart([mkItem()], [mkAppt()])).toEqual([]);
  });

  it('detects staff change', () => {
    const appt = mkAppt({ staffId: 'st1' });
    const item = mkItem({ appointmentId: 'a1', staffId: 'st2' });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([
      { id: 'a1', staff_id: 'st2' },
    ]);
  });

  it('detects price change', () => {
    const appt = mkAppt({ price: 100 });
    const item = mkItem({ appointmentId: 'a1', price: 80 });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([
      { id: 'a1', price: 80 },
    ]);
  });

  it('detects both changes together', () => {
    const appt = mkAppt({ staffId: 'st1', price: 100 });
    const item = mkItem({ appointmentId: 'a1', staffId: 'st2', price: 80 });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([
      { id: 'a1', staff_id: 'st2', price: 80 },
    ]);
  });

  it('skips cart items whose source appointment is missing', () => {
    const item = mkItem({ appointmentId: 'ghost' });
    expect(diffAppointmentsFromCart([item], [])).toEqual([]);
  });

  it('returns empty when staff and price match', () => {
    const appt = mkAppt({ staffId: 'st1', price: 100 });
    const item = mkItem({ appointmentId: 'a1', staffId: 'st1', price: 100 });
    expect(diffAppointmentsFromCart([item], [appt])).toEqual([]);
  });

  it('handles nullish staff — source unassigned, cart assigned', () => {
    const appt = mkAppt({ staffId: '' });
    const item = mkItem({ appointmentId: 'a1', staffId: 'st2' });
    const result = diffAppointmentsFromCart([item], [appt]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
    expect(result[0].staff_id).toBe('st2');
  });

  it('collects modifications across multiple cart items', () => {
    const appts = [mkAppt({ id: 'a1' }), mkAppt({ id: 'a2', price: 50 })];
    const cart = [
      mkItem({ id: 'ci1', appointmentId: 'a1', staffId: 'st2' }),
      mkItem({ id: 'ci2', appointmentId: 'a2', price: 40 }),
    ];
    const result = diffAppointmentsFromCart(cart, appts);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === 'a1')?.staff_id).toBe('st2');
    expect(result.find((r) => r.id === 'a2')?.price).toBe(40);
  });
});
