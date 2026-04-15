import { describe, expect, it } from 'vitest';
import { supplierSchema } from './schemas';

describe('supplierSchema', () => {
  it('accepts a supplier with only a name', () => {
    expect(supplierSchema.safeParse({ name: 'Acme' }).success).toBe(true);
  });

  it('rejects a supplier with no name', () => {
    const res = supplierSchema.safeParse({ name: '' });
    expect(res.success).toBe(false);
  });

  it('accepts empty email string', () => {
    expect(supplierSchema.safeParse({ name: 'A', email: '' }).success).toBe(true);
  });

  it('rejects malformed email', () => {
    const res = supplierSchema.safeParse({ name: 'A', email: 'not-email' });
    expect(res.success).toBe(false);
  });

  it('accepts null categoryId', () => {
    expect(supplierSchema.safeParse({ name: 'A', categoryId: null }).success).toBe(true);
  });
});
