import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExpenseSchema } from './schemas';

describe('buildExpenseSchema', () => {
  // Freeze wall-clock at 2026-05-14 (Casablanca-local) so "future" date tests
  // are deterministic regardless of when CI runs.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const schema = buildExpenseSchema('Africa/Casablanca');

  const valid = {
    description: 'Test expense',
    amount: 100,
    date: '2026-04-01',
    category: 'cat1',
  };

  it('accepts a valid expense', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('rejects amount of 0', () => {
    expect(schema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(schema.safeParse({ ...valid, amount: -10 }).success).toBe(false);
  });

  it('rejects date before 2020', () => {
    expect(schema.safeParse({ ...valid, date: '2019-12-31' }).success).toBe(false);
  });

  it('rejects date in the future', () => {
    expect(schema.safeParse({ ...valid, date: '2030-01-01' }).success).toBe(false);
  });

  it('rejects missing category', () => {
    expect(schema.safeParse({ ...valid, category: '' }).success).toBe(false);
  });

  it('accepts salon-today even when UTC has rolled to next day', () => {
    // Wall clock = 2026-05-14 23:30 Casablanca (UTC+1) → 22:30 UTC
    vi.setSystemTime(new Date('2026-05-14T22:30:00Z'));
    expect(schema.safeParse({ ...valid, date: '2026-05-14' }).success).toBe(true);
  });
});
