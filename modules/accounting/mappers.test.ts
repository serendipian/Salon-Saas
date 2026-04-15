import { describe, expect, it } from 'vitest';
import { toExpense, toExpenseInsert } from './mappers';

describe('toExpense', () => {
  it('pulls joined category name and color', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const joined: any = {
      id: 'e1',
      salon_id: 's1',
      date: '2026-04-01',
      description: 'Test',
      category_id: 'cat1',
      amount: 150.5,
      supplier_id: null,
      proof_url: null,
      payment_method: null,
      expense_categories: { name: 'Fournitures', color: '#ff0000' },
    };
    const e = toExpense(joined);
    expect(e.categoryName).toBe('Fournitures');
    expect(e.categoryColor).toBe('#ff0000');
    expect(e.category).toBe('cat1');
    expect(e.amount).toBe(150.5);
    expect(e.date).toBe('2026-04-01');
  });
});

describe('toExpenseInsert', () => {
  it('writes salon_id from argument', () => {
    const ins = toExpenseInsert(
      {
        date: '2026-04-01',
        description: 'Test',
        category: 'cat1',
        amount: 100,
      },
      's1',
    );
    expect(ins.salon_id).toBe('s1');
    expect(ins.category_id).toBe('cat1');
    expect(ins.amount).toBe(100);
  });
});
