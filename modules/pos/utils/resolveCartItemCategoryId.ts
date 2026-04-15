import type { CartItem, Service } from '../../../types';

/**
 * Returns the service category ID for a cart line, or `null` if none applies.
 *
 * For SERVICE lines, the cart's `referenceId` is the variant ID. We locate
 * the parent service and return its `categoryId` so staff selection can be
 * filtered by specialty (mirroring the appointment booking flow).
 *
 * For PRODUCT lines, returns `null` — products are not tied to a staff
 * specialty, so any active staff member may be attributed to the sale.
 */
export function resolveCartItemCategoryId(item: CartItem, services: Service[]): string | null {
  if (item.type !== 'SERVICE') return null;
  const parent = services.find((s) => s.variants.some((v) => v.id === item.referenceId));
  return parent?.categoryId ?? null;
}
