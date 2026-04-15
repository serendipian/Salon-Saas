import { describe, expect, it } from 'vitest';
import { toSupplier, toSupplierInsert } from './mappers';

describe('toSupplier', () => {
  it('maps core fields with null-safe defaults', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'sup1',
      salon_id: 's1',
      name: 'Acme Beauty',
      contact_name: null,
      email: null,
      phone: null,
      website: null,
      address: null,
      category_id: null,
      payment_terms: null,
      active: true,
      notes: null,
    };
    const s = toSupplier(row);
    expect(s.id).toBe('sup1');
    expect(s.name).toBe('Acme Beauty');
    expect(s.categoryId).toBeNull();
  });

  it('preserves non-null category', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 'sup1',
      salon_id: 's1',
      name: 'Test',
      contact_name: 'Alice',
      email: 'a@b.com',
      phone: null,
      website: null,
      address: null,
      category_id: 'cat1',
      payment_terms: null,
      active: true,
      notes: null,
    };
    const s = toSupplier(row);
    expect(s.categoryId).toBe('cat1');
    expect(s.contactName).toBe('Alice');
  });
});

describe('toSupplierInsert', () => {
  it('writes salon_id from argument', () => {
    const ins = toSupplierInsert(
      {
        id: 'x',
        name: 'Test',
        contactName: '',
        email: '',
        phone: '',
        categoryId: null,
        active: true,
      },
      'salon-xyz',
    );
    expect(ins.salon_id).toBe('salon-xyz');
    expect(ins.name).toBe('Test');
  });
});
