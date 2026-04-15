import { describe, expect, it } from 'vitest';
import { appointmentSchema, newClientSchema, serviceBlockSchema } from './schemas';

describe('appointmentSchema', () => {
  it('accepts valid appointment', () => {
    const res = appointmentSchema.safeParse({
      clientId: 'c1',
      staffId: 'st1',
      serviceId: 'sv1',
      date: '2026-05-01T10:00:00Z',
    });
    expect(res.success).toBe(true);
  });

  it('rejects missing client', () => {
    const res = appointmentSchema.safeParse({
      clientId: '',
      staffId: 'st1',
      serviceId: 'sv1',
      date: '2026-05-01T10:00:00Z',
    });
    expect(res.success).toBe(false);
  });

  it('rejects malformed date', () => {
    const res = appointmentSchema.safeParse({
      clientId: 'c1',
      staffId: 'st1',
      serviceId: 'sv1',
      date: 'not-a-date',
    });
    expect(res.success).toBe(false);
  });
});

describe('newClientSchema', () => {
  it('accepts valid new client', () => {
    const res = newClientSchema.safeParse({
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+212600000000',
    });
    expect(res.success).toBe(true);
  });

  it('rejects short phone', () => {
    const res = newClientSchema.safeParse({
      firstName: 'Jane',
      phone: '123',
    });
    expect(res.success).toBe(false);
  });
});

describe('serviceBlockSchema', () => {
  it('rejects block with no items', () => {
    const res = serviceBlockSchema.safeParse({
      items: [],
      staffId: 'st1',
      date: '2026-05-01',
      hour: 10,
      minute: 0,
    });
    expect(res.success).toBe(false);
  });

  it('rejects invalid minute value', () => {
    const res = serviceBlockSchema.safeParse({
      items: [{ serviceId: 'sv1', variantId: 'v1' }],
      staffId: 'st1',
      date: '2026-05-01',
      hour: 10,
      minute: 20, // not in [0,15,30,45]
    });
    expect(res.success).toBe(false);
  });

  it('accepts valid block', () => {
    const res = serviceBlockSchema.safeParse({
      items: [{ serviceId: 'sv1', variantId: 'v1' }],
      staffId: null,
      date: '2026-05-01',
      hour: 10,
      minute: 30,
    });
    expect(res.success).toBe(true);
  });
});
