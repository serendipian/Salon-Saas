import { describe, expect, it } from 'vitest';
import { staffMemberSchema } from './schemas';

describe('staffMemberSchema', () => {
  const valid = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+212600000000',
    role: 'Stylist' as const,
    commissionRate: 20,
  };

  it('accepts a valid staff member', () => {
    expect(staffMemberSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a missing first name', () => {
    const res = staffMemberSchema.safeParse({ ...valid, firstName: '' });
    expect(res.success).toBe(false);
  });

  it('rejects a missing phone', () => {
    const res = staffMemberSchema.safeParse({ ...valid, phone: '' });
    expect(res.success).toBe(false);
  });

  it('rejects commission rate > 100', () => {
    const res = staffMemberSchema.safeParse({ ...valid, commissionRate: 150 });
    expect(res.success).toBe(false);
  });

  it('rejects invalid role enum', () => {
    const res = staffMemberSchema.safeParse({ ...valid, role: 'CEO' });
    expect(res.success).toBe(false);
  });

  it('accepts empty email string', () => {
    const res = staffMemberSchema.safeParse({ ...valid, email: '' });
    expect(res.success).toBe(true);
  });

  it('rejects malformed email', () => {
    const res = staffMemberSchema.safeParse({ ...valid, email: 'not-email' });
    expect(res.success).toBe(false);
  });
});
