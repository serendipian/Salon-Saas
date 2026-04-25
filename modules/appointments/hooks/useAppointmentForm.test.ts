import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../context/ToastContext';
import type { Pack, Service, ServiceCategory } from '../../../types';

// Stub out the staff-availability hook — it pulls in useSettings → useAuth →
// Supabase, none of which are relevant to addPackBlocks behaviour.
vi.mock('./useStaffAvailability', () => ({
  useStaffAvailability: () => new Set<number>(),
}));

import { type UseAppointmentFormProps, useAppointmentForm } from './useAppointmentForm';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  createElement(ToastProvider, null, children);

const cat: ServiceCategory = {
  id: 'cat-hair',
  name: 'Coiffure',
  color: '#000',
  sortOrder: 0,
};

const makeService = (id: string, variantId: string, price: number, duration = 30): Service => ({
  id,
  name: `Service ${id}`,
  categoryId: cat.id,
  description: '',
  price,
  durationMinutes: duration,
  active: true,
  isFavorite: false,
  favoriteSortOrder: 0,
  variants: [
    {
      id: variantId,
      name: 'Standard',
      price,
      durationMinutes: duration,
      cost: 0,
      additionalCost: 0,
      isFavorite: false,
      favoriteSortOrder: 0,
    },
  ],
});

const makePack = (id: string, items: Array<{ svcId: string; varId: string }>): Pack => ({
  id,
  name: `Pack ${id}`,
  description: '',
  price: 100,
  active: true,
  isFavorite: false,
  favoriteSortOrder: null,
  sortOrder: 0,
  groupId: null,
  items: items.map((it, idx) => ({
    id: `pi-${id}-${idx}`,
    serviceId: it.svcId,
    serviceVariantId: it.varId,
    serviceName: '',
    variantName: '',
    originalPrice: 60,
    durationMinutes: 30,
    sortOrder: idx,
    isDeleted: false,
  })),
});

const svc1 = makeService('svc1', 'v1', 60);
const svc2 = makeService('svc2', 'v2', 60);
const svc3 = makeService('svc3', 'v3', 60);
const svc4 = makeService('svc4', 'v4', 60);

const packA = makePack('packA', [
  { svcId: svc1.id, varId: 'v1' },
  { svcId: svc2.id, varId: 'v2' },
]);
const packB = makePack('packB', [
  { svcId: svc3.id, varId: 'v3' },
  { svcId: svc4.id, varId: 'v4' },
]);

const baseProps: UseAppointmentFormProps = {
  services: [svc1, svc2, svc3, svc4],
  categories: [cat],
  favorites: [],
  packs: [packA, packB],
  team: [],
  clients: [],
  appointments: [],
  onSave: vi.fn(),
};

describe('useAppointmentForm — addPackBlocks', () => {
  it('S1: two different packs in two blocks coexist', () => {
    const { result } = renderHook(() => useAppointmentForm(baseProps), { wrapper });

    // Block 0 starts empty. Place packA into it.
    act(() => result.current.addPackBlocks(packA, 0));
    expect(result.current.serviceBlocks).toHaveLength(1);
    expect(result.current.serviceBlocks[0].packId).toBe(packA.id);

    // Add a new (empty) block, then place packB into it.
    act(() => result.current.addBlock());
    expect(result.current.serviceBlocks).toHaveLength(2);
    act(() => result.current.addPackBlocks(packB, 1));

    // Both packs coexist; block 0 is untouched.
    expect(result.current.serviceBlocks).toHaveLength(2);
    expect(result.current.serviceBlocks[0].packId).toBe(packA.id);
    expect(result.current.serviceBlocks[0].items).toHaveLength(2);
    expect(result.current.serviceBlocks[1].packId).toBe(packB.id);
    expect(result.current.serviceBlocks[1].items).toHaveLength(2);
    expect(result.current.activeBlockIndex).toBe(1);
  });

  it('S2: same pack in a different block is rejected (state unchanged)', () => {
    const { result } = renderHook(() => useAppointmentForm(baseProps), { wrapper });

    act(() => result.current.addPackBlocks(packA, 0));
    act(() => result.current.addBlock());
    const snapshotBefore = result.current.serviceBlocks;

    // Try to add packA again in block 1 — must reject.
    act(() => result.current.addPackBlocks(packA, 1));

    // Block 0 still has packA, block 1 still empty.
    expect(result.current.serviceBlocks[0].packId).toBe(packA.id);
    expect(result.current.serviceBlocks[1].packId ?? null).toBe(null);
    expect(result.current.serviceBlocks[1].items).toEqual([]);
    // Reference equality on block 0 — proves no mutation happened there.
    expect(result.current.serviceBlocks[0]).toBe(snapshotBefore[0]);
  });

  it('S3: tapping the same pack in the same block toggles it off (date preserved)', () => {
    const { result } = renderHook(() => useAppointmentForm(baseProps), { wrapper });

    act(() => result.current.addPackBlocks(packA, 0));
    // Stamp a date on the block to verify carry-over.
    act(() => result.current.updateBlock(0, { date: '2026-05-01' }));
    expect(result.current.serviceBlocks[0].date).toBe('2026-05-01');

    // Tap the same pack again → toggle off.
    act(() => result.current.addPackBlocks(packA, 0));

    const b = result.current.serviceBlocks[0];
    expect(b.packId ?? null).toBe(null);
    expect(b.items).toEqual([]);
    expect(b.staffId).toBe(null);
    expect(b.hour).toBe(null);
    expect(b.date).toBe('2026-05-01'); // preserved
  });

  it('S4: switching to a different pack in the same block replaces in place', () => {
    const { result } = renderHook(() => useAppointmentForm(baseProps), { wrapper });

    act(() => result.current.addPackBlocks(packA, 0));
    const blockIdBefore = result.current.serviceBlocks[0].id;

    act(() => result.current.addPackBlocks(packB, 0));

    expect(result.current.serviceBlocks).toHaveLength(1);
    const b = result.current.serviceBlocks[0];
    // Same block identity (id preserved → no remount, activeCategoryId stays on PACKS).
    expect(b.id).toBe(blockIdBefore);
    expect(b.packId).toBe(packB.id);
    expect(b.items.map((i) => i.serviceId)).toEqual([svc3.id, svc4.id]);
  });
});
