import { describe, expect, it } from 'vitest';
import { toProduct, toProductCategory } from './mappers';

describe('toProduct', () => {
  it('maps core fields', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'p1',
      salon_id: 's1',
      category_id: 'cat1',
      brand_id: null,
      name: 'Shampoo',
      description: null,
      usage_type: 'retail',
      price: 25,
      cost: 10,
      sku: 'SKU001',
      barcode: null,
      stock: 5,
      supplier_id: null,
      active: true,
    };
    const p = toProduct(row);
    expect(p.id).toBe('p1');
    expect(p.name).toBe('Shampoo');
    expect(p.usageType).toBe('retail');
    expect(p.stock).toBe(5);
  });
});

describe('toProductCategory', () => {
  it('maps name and color', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'cat1',
      salon_id: 's1',
      name: 'Hair Care',
      color: '#ff00aa',
      sort_order: 1,
    };
    const c = toProductCategory(row);
    expect(c.id).toBe('cat1');
    expect(c.name).toBe('Hair Care');
    expect(c.color).toBe('#ff00aa');
  });
});
