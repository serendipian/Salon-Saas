import { describe, expect, it } from 'vitest';
import { serviceSchema, serviceVariantSchema } from './schemas';

describe('serviceVariantSchema', () => {
  const valid = {
    id: 'v1',
    name: 'Short',
    durationMinutes: 30,
    price: 150,
    cost: 50,
    additionalCost: 0,
  };

  it('accepts a valid variant', () => {
    expect(serviceVariantSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects zero duration', () => {
    const res = serviceVariantSchema.safeParse({ ...valid, durationMinutes: 0 });
    expect(res.success).toBe(false);
  });

  it('rejects negative price', () => {
    const res = serviceVariantSchema.safeParse({ ...valid, price: -1 });
    expect(res.success).toBe(false);
  });
});

describe('serviceSchema', () => {
  const validVariant = {
    id: 'v1',
    name: 'Short',
    durationMinutes: 30,
    price: 150,
    cost: 50,
    additionalCost: 0,
  };

  it('accepts a service with at least one variant', () => {
    const res = serviceSchema.safeParse({
      name: 'Cut',
      categoryId: 'cat1',
      variants: [validVariant],
    });
    expect(res.success).toBe(true);
  });

  it('rejects a service with no variants', () => {
    const res = serviceSchema.safeParse({
      name: 'Cut',
      categoryId: 'cat1',
      variants: [],
    });
    expect(res.success).toBe(false);
  });

  it('rejects missing categoryId', () => {
    const res = serviceSchema.safeParse({
      name: 'Cut',
      categoryId: '',
      variants: [validVariant],
    });
    expect(res.success).toBe(false);
  });
});
