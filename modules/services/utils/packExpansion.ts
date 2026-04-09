import type { Pack, CartItem } from '../../../types';

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
    let maxPrice = 0;
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
  return pack.items.length > 0 && pack.items.every(
    (item) => item.serviceName !== '' && item.variantName !== '' && item.originalPrice > 0
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
