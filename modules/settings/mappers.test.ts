import { describe, expect, it } from 'vitest';
import { toSalonSettings } from './mappers';

describe('toSalonSettings', () => {
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  const baseRow: any = {
    id: 's1',
    slug: 'test-salon',
    name: 'Test Salon',
    timezone: 'Europe/Paris',
    currency: 'MAD',
    logo_url: null,
    subscription_tier: 'free',
    is_suspended: false,
    address: null,
    street: null,
    city: null,
    postal_code: null,
    country: null,
    neighborhood: null,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    instagram: null,
    facebook: null,
    tiktok: null,
    google_maps_url: null,
    business_registration: null,
    vat_rate: 0,
    schedule: null,
  };

  it('maps required fields', () => {
    const s = toSalonSettings(baseRow);
    expect(s.name).toBe('Test Salon');
    expect(s.currency).toBe('MAD');
  });

  it('defaults missing strings to empty', () => {
    const s = toSalonSettings(baseRow);
    expect(s.email).toBe('');
    expect(s.phone).toBe('');
  });
});
