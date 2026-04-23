import { describe, expect, it } from 'vitest';
import { toTransaction } from './mappers';

describe('toTransaction', () => {
  it('maps a SALE transaction with items + payments', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 't1',
      salon_id: 's1',
      client_id: 'c1',
      appointment_id: null,
      type: 'SALE',
      total: 300,
      ticket_number: 42,
      original_transaction_id: null,
      reason_category: null,
      reason_note: null,
      created_by: 'u1',
      created_at: '2026-04-01T10:00:00Z',
      clients: { first_name: 'Jane', last_name: 'Doe' },
      transaction_items: [
        {
          id: 'ti1',
          reference_id: 'sv1',
          type: 'SERVICE',
          name: 'Cut',
          variant_name: 'Short',
          price: 300,
          original_price: null,
          quantity: 1,
          cost: null,
          note: null,
          staff_id: 'st1',
          staff_name: 'Anna',
          original_item_id: null,
          pack_id: null,
          pack_name: null,
        },
      ],
      transaction_payments: [{ id: 'tp1', method: 'CASH', amount: 300 }],
      profiles: { first_name: 'Admin', last_name: 'User' },
    };
    const t = toTransaction(row);
    expect(t.id).toBe('t1');
    expect(t.type).toBe('SALE');
    expect(t.total).toBe(300);
    expect(t.ticketNumber).toBe(42);
    expect(t.items).toHaveLength(1);
    expect(t.items[0].name).toBe('Cut');
    expect(t.items[0].variantName).toBe('Short');
    expect(t.payments).toHaveLength(1);
  });

  it('preserves VOID type', () => {
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
    const row: any = {
      id: 't2',
      salon_id: 's1',
      client_id: null,
      appointment_id: null,
      type: 'VOID',
      total: -300,
      ticket_number: 43,
      original_transaction_id: 't1',
      reason_category: 'Erreur',
      reason_note: 'Test',
      created_by: null,
      created_at: '2026-04-01T11:00:00Z',
      clients: null,
      transaction_items: [],
      transaction_payments: [],
      profiles: null,
    };
    const t = toTransaction(row);
    expect(t.type).toBe('VOID');
    expect(t.originalTransactionId).toBe('t1');
    expect(t.total).toBe(-300);
  });
});
