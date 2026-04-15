import type { Pack, PackGroup, CartItem } from '../../../types';

/**
 * Expands a pack into individual CartItems with pro-rata discounted prices.
 * Each item gets: price = (variant.originalPrice / totalOriginal) * pack.price
 * Rounding remainder is applied to the most expensive item.
 */
export function expandPack(pack: Pack): CartItem[] {
  const totalOriginal = pack.items.reduce((sum, item) => sum + item.originalPrice, 0);

  if (totalOriginal === 0 || pack.items.length === 0) return [];

  const packId = crypto.randomUUID();

  // Calculate pro-rata prices, rounded to 2 decimals
  const items: CartItem[] = pack.items.map((item) => ({
    id: crypto.randomUUID(),
    referenceId: item.serviceVariantId,
    type: 'SERVICE' as const,
    name: item.serviceName,
    variantName: item.variantName,
    price: Math.round((item.originalPrice / totalOriginal) * pack.price * 100) / 100,
    originalPrice: item.originalPrice,
    quantity: 1,
    packId,
    packName: pack.name,
  }));

  // Fix rounding: apply cent difference to the most expensive item
  const roundedSum = items.reduce((sum, item) => sum + item.price, 0);
  const diff = Math.round((pack.price - roundedSum) * 100) / 100;

  if (diff !== 0) {
    let maxIndex = 0;
    let maxPrice = -1;
    for (let i = 0; i < items.length; i++) {
      if (pack.items[i].originalPrice > maxPrice) {
        maxPrice = pack.items[i].originalPrice;
        maxIndex = i;
      }
    }
    items[maxIndex].price = Math.round((items[maxIndex].price + diff) * 100) / 100;
  }

  return items;
}

/**
 * Checks if a pack is valid (all items reference active, non-deleted services/variants).
 */
export function isPackValid(pack: Pack): boolean {
  return (
    pack.items.length > 0 &&
    pack.items.every(
      (item) => item.serviceName !== '' && item.variantName !== '' && !item.isDeleted,
    )
  );
}

/**
 * Calculates the discount percentage for display.
 */
export function getPackDiscount(pack: Pack): number {
  const totalOriginal = pack.items.reduce((sum, item) => sum + item.originalPrice, 0);
  if (totalOriginal === 0) return 0;
  return Math.round(((totalOriginal - pack.price) / totalOriginal) * 100);
}

/**
 * Formats pack item count for UI display.
 * - All unique: "3 prestations"
 * - Duplicates present: "2 services (3 prestations)"
 */
export function formatPackItemCount(pack: Pack): string {
  const total = pack.items.length;
  const unique = new Set(pack.items.map((i) => i.serviceVariantId)).size;
  const prestationLabel = `${total} prestation${total !== 1 ? 's' : ''}`;
  if (unique === total) return prestationLabel;
  return `${unique} service${unique !== 1 ? 's' : ''} (${prestationLabel})`;
}

/**
 * Checks if a pack group is currently live:
 * - group.active is true
 * - now is within [starts_at, ends_at] if either is set
 */
export function isPackGroupLive(group: PackGroup, now: Date = new Date()): boolean {
  if (!group.active) return false;
  if (group.startsAt && new Date(group.startsAt) > now) return false;
  if (group.endsAt && new Date(group.endsAt) < now) return false;
  return true;
}

/**
 * Computes the effective visibility of a pack for customer-facing catalogs.
 * A pack is visible iff:
 * - pack.active
 * - pack has no group, OR the group exists AND is live
 */
export function isPackVisible(pack: Pack, groups: PackGroup[]): boolean {
  if (!pack.active) return false;
  if (!pack.groupId) return true;
  const group = groups.find((g) => g.id === pack.groupId);
  if (!group) return true; // orphaned group reference → don't hide
  return isPackGroupLive(group);
}
