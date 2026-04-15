import { describe, expect, it } from 'vitest';
import { productSchema } from './schemas';

describe('productSchema', () => {
  const valid = { name: 'Shampoo', categoryId: 'cat1', price: 25, cost: 10, stock: 5 };

  it('accepts a valid product', () => {
    expect(productSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing name', () => {
    const res = productSchema.safeParse({ ...valid, name: '' });
    expect(res.success).toBe(false);
  });

  it('rejects negative price', () => {
    const res = productSchema.safeParse({ ...valid, price: -5 });
    expect(res.success).toBe(false);
  });

  it('rejects non-integer stock', () => {
    const res = productSchema.safeParse({ ...valid, stock: 2.5 });
    expect(res.success).toBe(false);
  });
});
