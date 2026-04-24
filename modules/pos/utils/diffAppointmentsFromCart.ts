import type { Appointment, CartItem } from '../../../types';

export interface AppointmentModification {
  id: string;
  staff_id?: string | null;
  price?: number;
}

/**
 * Compare cart items that originated from appointments against their source
 * appointment rows. Returns an array of modification payloads for the
 * create_transaction RPC — one entry per appointment whose current cart-line
 * representation differs on staffId or price.
 *
 * Semantics:
 *  - Cart items without appointmentId are ignored (walk-in additions).
 *  - If the source appointment can't be resolved from the lookup list, the
 *    cart item is ignored.
 *  - staff-only change, price-only change, or both — each returns the fields
 *    that changed (the RPC uses COALESCE so unsent fields keep their current
 *    value).
 *  - No-op case (no differences): returns an empty array.
 */
export const diffAppointmentsFromCart = (
  cart: CartItem[],
  sourceAppointments: Appointment[],
): AppointmentModification[] => {
  const byId = new Map(sourceAppointments.map((a) => [a.id, a]));
  const modifications: AppointmentModification[] = [];

  for (const item of cart) {
    if (!item.appointmentId) continue;
    const source = byId.get(item.appointmentId);
    if (!source) continue;

    const staffDiff = (item.staffId ?? null) !== (source.staffId ?? null);
    const priceDiff = item.price !== source.price;

    if (staffDiff || priceDiff) {
      const mod: AppointmentModification = { id: source.id };
      if (staffDiff) mod.staff_id = item.staffId ?? null;
      if (priceDiff) mod.price = item.price;
      modifications.push(mod);
    }
  }

  return modifications;
};
