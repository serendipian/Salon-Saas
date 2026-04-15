import { describe, expect, it } from 'vitest';
import { expenseSchema } from './schemas';

describe('expenseSchema', () => {
  const valid = {
    description: 'Test expense',
    amount: 100,
    date: '2026-04-01',
    category: 'cat1',
  };

  it('accepts a valid expense', () => {
    expect(expenseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects amount of 0', () => {
    const res = expenseSchema.safeParse({ ...valid, amount: 0 });
    expect(res.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const res = expenseSchema.safeParse({ ...valid, amount: -10 });
    expect(res.success).toBe(false);
  });

  it('rejects date before 2020', () => {
    const res = expenseSchema.safeParse({ ...valid, date: '2019-12-31' });
    expect(res.success).toBe(false);
  });

  it('rejects date in the future', () => {
    const res = expenseSchema.safeParse({ ...valid, date: '2030-01-01' });
    expect(res.success).toBe(false);
  });

  it('rejects missing category', () => {
    const res = expenseSchema.safeParse({ ...valid, category: '' });
    expect(res.success).toBe(false);
  });
});
