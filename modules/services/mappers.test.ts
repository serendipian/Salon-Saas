import { describe, expect, it } from 'vitest';
import { toService, toServiceCategory, toServiceVariant } from './mappers';

describe('toServiceVariant', () => {
  it('maps fields including additional_cost default to 0', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'v1',
      service_id: 'sv1',
      salon_id: 's1',
      name: 'Short',
      duration_minutes: 30,
      price: 150,
      cost: 50,
      additional_cost: 0,
      is_favorite: false,
      favorite_sort_order: 0,
      sort_order: 1,
    };
    const v = toServiceVariant(row);
    expect(v.id).toBe('v1');
    expect(v.name).toBe('Short');
    expect(v.price).toBe(150);
    // mapper does not coerce null — reflects the row's literal value
    expect(v.additionalCost).toBe(0);
  });
});

describe('toService', () => {
  it('maps a service with joined variants array', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'sv1',
      salon_id: 's1',
      category_id: 'cat1',
      name: 'Coupe',
      description: null,
      active: true,
      is_favorite: false,
      favorite_sort_order: 0,
      service_variants: [
        {
          id: 'v1',
          service_id: 'sv1',
          salon_id: 's1',
          name: 'Short',
          duration_minutes: 30,
          price: 150,
          cost: 50,
          additional_cost: 0,
          is_favorite: false,
          favorite_sort_order: 0,
          sort_order: 1,
        },
      ],
    };
    const s = toService(row);
    expect(s.id).toBe('sv1');
    expect(s.name).toBe('Coupe');
    expect(s.variants).toHaveLength(1);
    expect(s.variants[0].price).toBe(150);
  });

  it('handles empty variants', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'sv1',
      salon_id: 's1',
      category_id: 'cat1',
      name: 'Coupe',
      description: null,
      active: true,
      is_favorite: false,
      favorite_sort_order: 0,
      service_variants: [],
    };
    const s = toService(row);
    expect(s.variants).toEqual([]);
  });
});

describe('toServiceCategory', () => {
  it('maps name, color and icon', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'cat1',
      salon_id: 's1',
      name: 'Coiffure',
      color: 'rose',
      icon: 'scissors',
      sort_order: 1,
    };
    const c = toServiceCategory(row);
    expect(c.id).toBe('cat1');
    expect(c.name).toBe('Coiffure');
    expect(c.icon).toBe('scissors');
  });
});
