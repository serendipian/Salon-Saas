import { describe, expect, it } from 'vitest';
import type { ServiceBlockState } from '../../../types';
import { buildMissingFields, humanizeMissing } from './missingFields';

const mkBlock = (overrides: Partial<ServiceBlockState>): ServiceBlockState => ({
  id: overrides.id ?? crypto.randomUUID(),
  categoryId: 'cat-1',
  items: [],
  staffId: null,
  date: null,
  hour: null,
  minute: 0,
  ...overrides,
});

describe('buildMissingFields', () => {
  it('reports client missing when no clientId and no newClient', () => {
    const result = buildMissingFields({
      clientId: null,
      newClient: null,
      blocks: [
        mkBlock({
          items: [{ serviceId: 's', variantId: 'v' }],
          staffId: 'st',
          date: '2026-04-27',
          hour: 10,
        }),
      ],
    });
    expect(result).toContainEqual({ kind: 'client' });
  });

  it('does not report client missing when newClient is set', () => {
    const result = buildMissingFields({
      clientId: null,
      newClient: { firstName: 'A', lastName: 'B', phone: '+33' },
      blocks: [
        mkBlock({
          items: [{ serviceId: 's', variantId: 'v' }],
          staffId: 'st',
          date: '2026-04-27',
          hour: 10,
        }),
      ],
    });
    expect(result.some((f) => f.kind === 'client')).toBe(false);
  });

  it('reports service missing per empty block', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [mkBlock({}), mkBlock({})],
    });
    expect(result.filter((f) => f.kind === 'service')).toHaveLength(2);
    expect(result[0]).toEqual({ kind: 'service', blockIndex: 0 });
    expect(result[1]).toEqual({ kind: 'service', blockIndex: 1 });
  });

  it('reports staff missing only when block has items but no staffId AND staffConfirmed is not true', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({
          items: [{ serviceId: 's', variantId: 'v' }],
          staffId: null,
          staffConfirmed: false,
        }),
      ],
    });
    expect(result).toContainEqual({ kind: 'staff', blockIndex: 0 });
  });

  it('does NOT report staff missing when staffConfirmed=true (explicit "Aucun")', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({
          items: [{ serviceId: 's', variantId: 'v' }],
          staffId: null,
          staffConfirmed: true,
          date: '2026-04-27',
          hour: 10,
        }),
      ],
    });
    expect(result.some((f) => f.kind === 'staff')).toBe(false);
  });

  it('reports datetime missing when block has items + staff but no date or hour', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({
          items: [{ serviceId: 's', variantId: 'v' }],
          staffId: 'st',
          date: null,
          hour: null,
        }),
      ],
    });
    expect(result).toContainEqual({ kind: 'datetime', blockIndex: 0 });
  });

  it('returns empty array when fully complete', () => {
    const result = buildMissingFields({
      clientId: 'c1',
      newClient: null,
      blocks: [
        mkBlock({
          items: [{ serviceId: 's', variantId: 'v' }],
          staffId: 'st',
          date: '2026-04-27',
          hour: 10,
        }),
      ],
    });
    expect(result).toEqual([]);
  });
});

describe('humanizeMissing', () => {
  it('joins unique kinds in fixed order with French labels', () => {
    expect(
      humanizeMissing([
        { kind: 'datetime', blockIndex: 0 },
        { kind: 'client' },
        { kind: 'datetime', blockIndex: 1 },
        { kind: 'service', blockIndex: 0 },
      ]),
    ).toBe('Client, Service, Date & heure');
  });

  it('returns empty string for empty array', () => {
    expect(humanizeMissing([])).toBe('');
  });

  it('handles single missing field', () => {
    expect(humanizeMissing([{ kind: 'staff', blockIndex: 0 }])).toBe('Membre');
  });
});
