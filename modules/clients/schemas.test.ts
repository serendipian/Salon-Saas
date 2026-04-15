import { describe, expect, it } from 'vitest';
import { clientSchema } from './schemas';

describe('clientSchema', () => {
  it('accepts a minimal client with only a first name', () => {
    const res = clientSchema.safeParse({ firstName: 'Jane' });
    expect(res.success).toBe(true);
  });

  it('rejects a client with no name at all', () => {
    const res = clientSchema.safeParse({});
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Le prénom ou le nom est requis');
    }
  });

  it('accepts a client with only last name', () => {
    const res = clientSchema.safeParse({ lastName: 'Doe' });
    expect(res.success).toBe(true);
  });

  it('accepts empty email string', () => {
    const res = clientSchema.safeParse({ firstName: 'Jane', email: '' });
    expect(res.success).toBe(true);
  });

  it('rejects malformed email', () => {
    const res = clientSchema.safeParse({ firstName: 'Jane', email: 'not-an-email' });
    expect(res.success).toBe(false);
  });

  it('requires otherChannelDetail when preferredChannel is Autre', () => {
    const res = clientSchema.safeParse({
      firstName: 'Jane',
      preferredChannel: 'Autre',
    });
    expect(res.success).toBe(false);
  });

  it('rejects invalid status enum', () => {
    const res = clientSchema.safeParse({ firstName: 'Jane', status: 'BOGUS' });
    expect(res.success).toBe(false);
  });
});
