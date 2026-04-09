# Multi-Service Appointment Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an appointment "service block" to hold multiple services/variants from the same category, all sharing one staff member and one start time, stacking sequentially on save — without any DB changes.

**Architecture:** Frontend-only refactor. Replace `ServiceBlockState.{serviceId, variantId, priceOverride}` with `items: ServiceBlockItem[]`. Expansion to flat DB rows happens in `useAppointmentForm.handleSubmit`. On edit, consecutive same-group / same-staff / same-category / back-to-back appointments are merged back into multi-item blocks via a heuristic. Packs stay atomic (1 item per block). Single-service flow is a `items.length === 1` degenerate case — zero regression.

**Tech Stack:** React 19 + TypeScript, TanStack Query, Zod, Tailwind CSS 4, Supabase (unchanged), Vite.

**Reference spec:** [docs/superpowers/specs/2026-04-09-multi-service-appointment-block-design.md](docs/superpowers/specs/2026-04-09-multi-service-appointment-block-design.md)

---

## File Structure

| File | Responsibility | Change type |
|---|---|---|
| [types.ts](types.ts) | `ServiceBlockItem` + `ServiceBlockState` shape | Modify |
| [modules/appointments/schemas.ts](modules/appointments/schemas.ts) | Zod schema for new block shape | Modify |
| [modules/appointments/hooks/useAppointmentForm.ts](modules/appointments/hooks/useAppointmentForm.ts) | Form state, toggle logic, submit expansion, derived totals | Modify |
| [modules/appointments/components/ServiceGrid.tsx](modules/appointments/components/ServiceGrid.tsx) | Multi-select grid with toggle + remove click guards | Modify |
| [modules/appointments/components/VariantList.tsx](modules/appointments/components/VariantList.tsx) | Allow clicking selected variant to deselect | Modify |
| [modules/appointments/components/ServiceBlock.tsx](modules/appointments/components/ServiceBlock.tsx) | Multi-item UI, category lock, "Vider" button, summary | Modify |
| [modules/appointments/components/MobileServicePicker.tsx](modules/appointments/components/MobileServicePicker.tsx) | Multi-select picker with "Valider (N)" button | Modify |
| [modules/appointments/components/AppointmentBuilderMobile.tsx](modules/appointments/components/AppointmentBuilderMobile.tsx) | Use new items shape, pass initial items to picker | Modify |
| [modules/appointments/components/AppointmentBuilder.tsx](modules/appointments/components/AppointmentBuilder.tsx) | Pass-through props update | Modify |
| [modules/appointments/components/AppointmentSummary.tsx](modules/appointments/components/AppointmentSummary.tsx) | Iterate over items within blocks | Modify |
| [modules/appointments/pages/AppointmentEditPage.tsx](modules/appointments/pages/AppointmentEditPage.tsx) | Edit-mode grouping heuristic | Modify |

No files created. No files deleted.

---

## Pre-flight

- [ ] **Step 0.1: Verify clean baseline**

```bash
cd "/Users/sims/Casa de Chicas/Salon-Saas"
git status
```

Expected: working tree has only unrelated pre-existing changes (per CLAUDE.md context: `MobileServicePicker.tsx`, `ServiceBlock.tsx`, `POSCatalog.tsx`, `PackList.tsx`, `packExpansion.ts`). If any of these files have unrelated staged changes, stash them before starting.

- [ ] **Step 0.2: Build baseline**

```bash
npm run build
```

Expected: build succeeds. Take note of any existing TypeScript warnings so we don't attribute them to our changes.

---

## Task 1: Update type definitions

**Files:**
- Modify: [types.ts](types.ts):384-395

**Goal:** Introduce `ServiceBlockItem` and reshape `ServiceBlockState`.

- [ ] **Step 1.1: Replace the ServiceBlockState definition**

Open [types.ts](types.ts) and replace lines 384-395 with:

```ts
export interface ServiceBlockItem {
  serviceId: string;
  variantId: string;
  priceOverride?: number;
}

export interface ServiceBlockState {
  id: string;
  categoryId: string | null;
  items: ServiceBlockItem[];
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
  packId?: string | null;
}
```

- [ ] **Step 1.2: Run typecheck to see breakage**

```bash
npx tsc --noEmit
```

Expected: many errors in `useAppointmentForm.ts`, `ServiceBlock.tsx`, `ServiceGrid.tsx`, `AppointmentBuilderMobile.tsx`, `AppointmentSummary.tsx`, `AppointmentEditPage.tsx` — all referencing the removed `serviceId`/`variantId`/`priceOverride` fields. **This is expected** — those will all be fixed in subsequent tasks. Do NOT try to fix them now.

- [ ] **Step 1.3: Commit**

```bash
git add types.ts
git commit -m "refactor(appointments): reshape ServiceBlockState to use items[] array"
```

---

## Task 2: Update Zod schema

**Files:**
- Modify: [modules/appointments/schemas.ts](modules/appointments/schemas.ts):20-30

**Goal:** Validate the new block shape.

- [ ] **Step 2.1: Replace the serviceBlockSchema**

In [modules/appointments/schemas.ts](modules/appointments/schemas.ts), replace lines 20-30 with:

```ts
export const serviceBlockItemSchema = z.object({
  serviceId: z.string().min(1, 'Le service est requis'),
  variantId: z.string(),
  priceOverride: z.number().optional(),
});

export const serviceBlockSchema = z.object({
  items: z.array(serviceBlockItemSchema).min(1, 'Au moins un service est requis'),
  staffId: z.string().nullable(),
  date: z.string().min(1, 'La date est requise'),
  hour: z.number().min(0, "L'heure est requise").max(23, "L'heure doit être entre 0 et 23"),
  minute: z.number().refine(
    (m) => [0, 15, 30, 45].includes(m),
    { message: 'Les minutes doivent être 00, 15, 30 ou 45' },
  ),
});
```

Leave `appointmentSchema`, `newClientSchema`, and `appointmentGroupSchema` untouched — `appointmentGroupSchema` references `serviceBlockSchema` by name and picks up the new shape automatically.

- [ ] **Step 2.2: Commit**

```bash
git add modules/appointments/schemas.ts
git commit -m "refactor(appointments): update zod schema for multi-item service blocks"
```

---

## Task 3: Refactor useAppointmentForm — state shape and derived values

**Files:**
- Modify: [modules/appointments/hooks/useAppointmentForm.ts](modules/appointments/hooks/useAppointmentForm.ts)

**Goal:** Reshape internal state for `items[]`, replace single-service derivations with block-level aggregates, add helper functions.

This task is large. Do it in substeps.

- [ ] **Step 3.1: Update imports and type imports**

In [modules/appointments/hooks/useAppointmentForm.ts](modules/appointments/hooks/useAppointmentForm.ts), update the import from `types` on line 2-12 to include `ServiceBlockItem`:

```ts
import type {
  Appointment,
  AppointmentStatus,
  ServiceBlockState,
  ServiceBlockItem,
  Service,
  ServiceCategory,
  StaffMember,
  Client,
  FavoriteItem,
  Pack,
} from '../../../types';
```

- [ ] **Step 3.2: Update createEmptyBlock**

Replace the existing `createEmptyBlock` function (lines 97-108) with:

```ts
export function createEmptyBlock(): ServiceBlockState {
  return {
    id: crypto.randomUUID(),
    categoryId: null,
    items: [],
    staffId: null,
    date: null,
    hour: null,
    minute: 0,
  };
}
```

- [ ] **Step 3.3: Add block-level helper functions (module scope)**

Add these helper functions after `createEmptyBlock` and before `useAppointmentForm`:

```ts
export function getBlockDuration(block: ServiceBlockState, services: Service[]): number {
  return block.items.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    const variant = svc?.variants.find((v) => v.id === item.variantId);
    return sum + (variant?.durationMinutes ?? svc?.durationMinutes ?? 0);
  }, 0);
}

export function getBlockPrice(block: ServiceBlockState, services: Service[]): number {
  return block.items.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    const variant = svc?.variants.find((v) => v.id === item.variantId);
    return sum + (item.priceOverride ?? variant?.price ?? svc?.price ?? 0);
  }, 0);
}
```

- [ ] **Step 3.4: Update the AppointmentFormReturn interface**

Replace the `AppointmentFormReturn` interface (lines 51-95) with:

```ts
export interface AppointmentFormReturn {
  // State
  clientId: string | null;
  newClient: { firstName: string; lastName: string; phone: string } | null;
  serviceBlocks: ServiceBlockState[];
  activeBlockIndex: number;
  status: AppointmentStatus;
  notes: string;
  reminderMinutes: number | null;
  isSaving: boolean;
  errors: Record<string, string>;

  // Derived
  activeBlock: ServiceBlockState | undefined;
  activeStaff: StaffMember | null;
  activeBlockDuration: number;
  activeBlockPrice: number;
  unavailableHours: Set<number>;
  availabilityAppointments: Appointment[];
  totalDuration: number;
  totalPrice: number;
  hasCompleteServiceBlock: boolean;
  allBlocksScheduled: boolean;

  // Actions
  setClientId: (id: string | null) => void;
  setNewClient: (data: { firstName: string; lastName: string; phone: string } | null) => void;
  setStatus: (status: AppointmentStatus) => void;
  setNotes: (notes: string) => void;
  setReminderMinutes: (minutes: number | null) => void;
  setActiveBlockIndex: (index: number) => void;
  updateBlock: (index: number, updates: Partial<ServiceBlockState>) => void;
  toggleBlockItem: (index: number, serviceId: string, variantId: string) => void;
  clearBlockItems: (index: number) => void;
  removeBlock: (index: number) => void;
  addBlock: () => void;
  addPackBlocks: (pack: Pack) => void;
  clearFieldError: (field: string) => void;

  // Helpers
  getBlockSummary: (block: ServiceBlockState) => string;
  handleSubmit: () => Promise<void>;

  // Props passthrough for components
  initialData: UseAppointmentFormProps['initialData'];
}
```

Note removed fields: `activeVariant`, `activeService`, `effectiveDuration`. Added: `activeBlockDuration`, `activeBlockPrice`, `toggleBlockItem`, `clearBlockItems`.

- [ ] **Step 3.5: Replace the active-block derivations**

Find the block at lines 141-157 (starts with `const activeBlock = serviceBlocks[activeBlockIndex];`) and replace through the end of `effectiveDuration` (line 157) with:

```ts
  // Active block
  const activeBlock = serviceBlocks[activeBlockIndex];
  const activeStaff = useMemo(
    () => team.find((m) => m.id === activeBlock?.staffId) ?? null,
    [team, activeBlock?.staffId],
  );

  const activeBlockDuration = useMemo(
    () => (activeBlock ? getBlockDuration(activeBlock, services) : 0),
    [activeBlock, services],
  );

  const activeBlockPrice = useMemo(
    () => (activeBlock ? getBlockPrice(activeBlock, services) : 0),
    [activeBlock, services],
  );
```

- [ ] **Step 3.6: Update the availability hook call**

Find the `useStaffAvailability` call (around line 167) and replace the duration argument:

```ts
  const unavailableHours = useStaffAvailability(
    activeStaff,
    activeBlock?.date ?? null,
    activeBlockDuration || 30,
    availabilityAppointments,
  );
```

The `|| 30` fallback keeps the picker usable when `items[]` is empty (same as today's empty-block fallback).

- [ ] **Step 3.7: Replace totals computations**

Replace the `totalDuration` and `totalPrice` memos (lines 174-189) with:

```ts
  // Totals & completeness
  const totalDuration = useMemo(
    () => serviceBlocks.reduce((sum, b) => sum + getBlockDuration(b, services), 0),
    [serviceBlocks, services],
  );

  const totalPrice = useMemo(
    () => serviceBlocks.reduce((sum, b) => sum + getBlockPrice(b, services), 0),
    [serviceBlocks, services],
  );

  const hasCompleteServiceBlock = serviceBlocks.some((b) => b.items.length > 0);

  const allBlocksScheduled = serviceBlocks.every(
    (b) => b.items.length > 0 && b.date && b.hour !== null,
  );
```

- [ ] **Step 3.8: Add toggleBlockItem and clearBlockItems actions**

After the `updateBlock` useCallback (around line 200) and before `removeBlock`, add:

```ts
  const toggleBlockItem = useCallback(
    (index: number, serviceId: string, variantId: string) => {
      setServiceBlocks((prev) =>
        prev.map((b, i) => {
          if (i !== index) return b;
          if (b.packId) return b; // pack blocks are atomic
          const existingIdx = b.items.findIndex((item) => item.serviceId === serviceId);
          if (existingIdx >= 0) {
            const existing = b.items[existingIdx];
            if (existing.variantId === variantId) {
              // Same service + same variant → remove
              return { ...b, items: b.items.filter((_, idx) => idx !== existingIdx) };
            }
            // Same service, different variant → replace variant
            const nextItems = b.items.slice();
            nextItems[existingIdx] = { ...existing, variantId };
            return { ...b, items: nextItems };
          }
          // New service → append
          return { ...b, items: [...b.items, { serviceId, variantId }] };
        }),
      );
    },
    [],
  );

  const clearBlockItems = useCallback((index: number) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        if (b.packId) return b; // pack blocks are atomic
        return { ...b, items: [] };
      }),
    );
  }, []);
```

- [ ] **Step 3.9: Update addPackBlocks to use items[]**

Find `addPackBlocks` (around line 229). In the block that constructs `newBlocks` (around line 268), replace:

```ts
      const newBlocks: ServiceBlockState[] = pack.items.map((item, i) => ({
        id: crypto.randomUUID(),
        categoryId: null,
        serviceId: item.serviceId,
        variantId: item.serviceVariantId,
        staffId: null,
        date: lastDate,
        hour: null,
        minute: 0,
        priceOverride: proRataPrices[i],
        packId: pack.id,
      }));
```

with:

```ts
      const newBlocks: ServiceBlockState[] = pack.items.map((item, i) => ({
        id: crypto.randomUUID(),
        categoryId: null,
        items: [
          {
            serviceId: item.serviceId,
            variantId: item.serviceVariantId,
            priceOverride: proRataPrices[i],
          },
        ],
        staffId: null,
        date: lastDate,
        hour: null,
        minute: 0,
        packId: pack.id,
      }));
```

- [ ] **Step 3.10: Update getBlockSummary for multi-item blocks**

Replace `getBlockSummary` (lines 288-305) with:

```ts
  const getBlockSummary = useCallback(
    (block: ServiceBlockState): string => {
      const staff = team.find((m) => m.id === block.staffId);
      const staffLabel = staff
        ? `${staff.firstName}${staff.lastName ? ` ${staff.lastName[0]}.` : ''}`
        : null;

      const duration = getBlockDuration(block, services);
      const price = getBlockPrice(block, services);

      const parts: string[] = [];
      if (block.items.length === 0) {
        return 'Service';
      }
      if (block.items.length === 1) {
        const item = block.items[0];
        const svc = services.find((s) => s.id === item.serviceId);
        const variant = svc?.variants.find((v) => v.id === item.variantId);
        if (svc?.name) parts.push(svc.name);
        if (variant?.name) parts.push(`· ${variant.name}`);
      } else {
        parts.push(`${block.items.length} prestations`);
      }
      if (duration > 0) parts.push(`· ${formatDuration(duration)}`);
      if (price > 0) parts.push(`· ${formatPrice(price)}`);
      if (staffLabel) parts.push(`· ${staffLabel}`);
      return parts.join(' ');
    },
    [services, team],
  );
```

Add `formatDuration` to the import from `../../../lib/format` at the top of the file:

```ts
import { formatPrice, formatDuration } from '../../../lib/format';
```

- [ ] **Step 3.11: Update handleSubmit expansion logic**

Replace `handleSubmit` (lines 308-374) with:

```ts
  const handleSubmit = useCallback(async () => {
    const effectiveClientId = newClient ? 'pending-new-client' : (clientId ?? '');

    // Flatten items for validation (schema expects items array per block)
    const formData = {
      clientId: effectiveClientId,
      serviceBlocks: serviceBlocks.map((b) => ({
        items: b.items,
        staffId: b.staffId,
        date: b.date ?? '',
        hour: b.hour ?? -1,
        minute: b.minute,
      })),
      status,
      notes,
      reminderMinutes,
    };

    const result = validate(formData);
    if (!result) return;

    // Validate new client separately if present
    if (newClient) {
      const clientResult = newClientSchema.safeParse(newClient);
      if (!clientResult.success) {
        return;
      }
    }

    // Build save payload — expand each block's items[] into N sequential rows
    const flatBlocks: Array<{
      serviceId: string;
      variantId: string;
      staffId: string | null;
      date: string;
      durationMinutes: number;
      price: number;
    }> = [];

    for (const block of serviceBlocks) {
      const dateStr = block.date ?? '';
      const startHour = block.hour ?? 0;
      const startMin = block.minute;
      const [year, month, day] = dateStr.split('-').map(Number);
      let cursor = new Date(year, month - 1, day, startHour, startMin, 0, 0);

      for (const item of block.items) {
        const svc = services.find((s) => s.id === item.serviceId);
        const variant = svc?.variants.find((v) => v.id === item.variantId);
        const durationMinutes = variant?.durationMinutes ?? svc?.durationMinutes ?? 30;
        const price = item.priceOverride ?? variant?.price ?? svc?.price ?? 0;

        flatBlocks.push({
          serviceId: item.serviceId,
          variantId: item.variantId,
          staffId: block.staffId,
          date: cursor.toISOString(),
          durationMinutes,
          price,
        });

        cursor = new Date(cursor.getTime() + durationMinutes * 60_000);
      }
    }

    const payload = {
      clientId: clientId ?? '',
      newClient,
      notes,
      reminderMinutes,
      status,
      serviceBlocks: flatBlocks,
    };

    setIsSaving(true);
    try {
      await onSave(payload);
    } catch {
      // Error handled by caller's onError
    } finally {
      setIsSaving(false);
    }
  }, [newClient, clientId, serviceBlocks, status, notes, reminderMinutes, validate, services, onSave]);
```

- [ ] **Step 3.12: Update the return object**

At the bottom of `useAppointmentForm` (lines 376-421), replace with:

```ts
  return {
    // State
    clientId,
    newClient,
    serviceBlocks,
    activeBlockIndex,
    status,
    notes,
    reminderMinutes,
    isSaving,
    errors,

    // Derived
    activeBlock,
    activeStaff,
    activeBlockDuration,
    activeBlockPrice,
    unavailableHours,
    availabilityAppointments,
    totalDuration,
    totalPrice,
    hasCompleteServiceBlock,
    allBlocksScheduled,

    // Actions
    setClientId,
    setNewClient,
    setStatus,
    setNotes,
    setReminderMinutes,
    setActiveBlockIndex,
    updateBlock,
    toggleBlockItem,
    clearBlockItems,
    removeBlock,
    addBlock,
    addPackBlocks,
    clearFieldError,

    // Helpers
    getBlockSummary,
    handleSubmit,

    // Props passthrough
    initialData,
  };
```

- [ ] **Step 3.13: Verify file compiles in isolation**

```bash
npx tsc --noEmit 2>&1 | grep "useAppointmentForm" | head -20
```

Expected: zero errors in `useAppointmentForm.ts`. There will still be errors in the component files that consume it (to be fixed in later tasks).

- [ ] **Step 3.14: Commit**

```bash
git add modules/appointments/hooks/useAppointmentForm.ts
git commit -m "refactor(appointments): useAppointmentForm supports multi-item blocks with sequential expansion"
```

---

## Task 4: Update VariantList to allow deselection

**Files:**
- Modify: [modules/appointments/components/VariantList.tsx](modules/appointments/components/VariantList.tsx)

**Goal:** Remove any guard preventing clicks on the already-selected variant. (The current file already fires `onSelect` unconditionally — verify and make no change if already correct.)

- [ ] **Step 4.1: Verify current behavior**

Read [modules/appointments/components/VariantList.tsx](modules/appointments/components/VariantList.tsx). The `onClick` handler is `onClick={() => onSelect(v.id)}` — it already fires unconditionally even when `isSelected`. **No code change needed.**

- [ ] **Step 4.2: No commit**

Task is a no-op after verification. Move to Task 5.

---

## Task 5: Refactor ServiceGrid to multi-select

**Files:**
- Modify: [modules/appointments/components/ServiceGrid.tsx](modules/appointments/components/ServiceGrid.tsx)

**Goal:** Replace single-selection props with `selectedItems[]` + `onToggleItem`. Remove the `!isSelected &&` click guards.

- [ ] **Step 5.1: Replace the props interface**

Replace the import and interface at the top (lines 1-14) with:

```ts
import React, { useMemo } from 'react';
import type { Service, ServiceCategory, FavoriteItem, ServiceBlockItem } from '../../../types';
import VariantList from './VariantList';
import { Check } from 'lucide-react';

interface ServiceGridProps {
  services: Service[];
  favorites?: FavoriteItem[];
  categories?: ServiceCategory[];
  selectedItems: ServiceBlockItem[];
  onToggleItem: (serviceId: string, variantId: string) => void;
}
```

- [ ] **Step 5.2: Replace destructured props**

In the function signature (line 16-24), replace with:

```ts
export default function ServiceGrid({
  services,
  favorites = [],
  categories = [],
  selectedItems,
  onToggleItem,
}: ServiceGridProps) {
```

- [ ] **Step 5.3: Add selection helper**

After the `categoryMap` useMemo (around line 31), add:

```ts
  const getSelectedVariantIdForService = (serviceId: string): string | null => {
    return selectedItems.find((i) => i.serviceId === serviceId)?.variantId ?? null;
  };

  const isServiceSelected = (serviceId: string): boolean => {
    return selectedItems.some((i) => i.serviceId === serviceId);
  };
```

- [ ] **Step 5.4: Rewrite the favorites grid — service type, single variant**

In the favorites `.map()` for `fav.type === 'service'` with single variant (lines 49-76), replace the inner `<div>` block with:

```tsx
              if (isSingleVariant && variant) {
                const isSelected = isServiceSelected(svc.id) && getSelectedVariantIdForService(svc.id) === variant.id;
                return (
                  <div
                    key={`fav-svc-${svc.id}`}
                    className={`rounded-xl p-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-2 border-blue-400 shadow-sm'
                        : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                    onClick={() => onToggleItem(svc.id, variant.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onToggleItem(svc.id, variant.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        {catName && <><span className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{catName}</span><span className="text-xs text-slate-500"> — </span></>}
                        <span className={`text-xs ${catName ? 'text-slate-500' : `font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}`}>{svc.name}</span>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                          <Check size={12} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
```

- [ ] **Step 5.5: Rewrite the favorites grid — service type, multi-variant**

Replace the multi-variant favorite block (approx. lines 78-111) with:

```tsx
              // Multi-variant service: expandable card
              const isSelected = isServiceSelected(svc.id);
              const selectedVariantId = getSelectedVariantIdForService(svc.id);
              return (
                <div
                  key={`fav-svc-${svc.id}`}
                  className={`rounded-xl p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-blue-400 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="flex justify-between items-start"
                    onClick={() => {
                      if (isSelected && selectedVariantId) {
                        // Click card header of selected multi-variant service → deselect
                        onToggleItem(svc.id, selectedVariantId);
                      }
                      // Otherwise, do nothing on header click — user picks a variant below
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isSelected && selectedVariantId) {
                        onToggleItem(svc.id, selectedVariantId);
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      {catName && <span className="text-[11px] text-slate-400">{catName}</span>}
                      <div className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{svc.name}</div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm shrink-0 ml-1">
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  {/* Variant list always shown for multi-variant services */}
                  <VariantList
                    variants={svc.variants}
                    selectedVariantId={selectedVariantId}
                    onSelect={(vid) => onToggleItem(svc.id, vid)}
                  />
                </div>
              );
```

Note: for multi-variant services, always show the variant list (not just when selected). This makes variant picks possible without a two-click expand/pick flow.

- [ ] **Step 5.6: Rewrite the variant-type favorite**

Replace the variant favorite block (approx. lines 112-142) with:

```tsx
            } else if (fav.type === 'variant') {
              // Variant-type favorite — standalone card
              const { variant, parentService } = fav;
              const isSelected = selectedItems.some(
                (i) => i.serviceId === parentService.id && i.variantId === variant.id,
              );
              return (
                <div
                  key={`fav-var-${variant.id}`}
                  className={`rounded-xl p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-blue-400 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                  onClick={() => onToggleItem(parentService.id, variant.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onToggleItem(parentService.id, variant.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{parentService.name}</span>
                      <span className="text-xs text-slate-500"> — {variant.name}</span>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                </div>
              );
            }
```

- [ ] **Step 5.7: Rewrite the regular services grid**

Replace the regular services grid (approx. lines 148-184) with:

```tsx
      {/* Regular services grid */}
      {services.length > 0 && (
        <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
          {services.map((svc) => {
            const isSelected = isServiceSelected(svc.id);
            const selectedVariantId = getSelectedVariantIdForService(svc.id);
            const isSingleVariant = svc.variants.length === 1;
            const singleVariant = svc.variants[0];

            return (
              <div
                key={svc.id}
                className={`rounded-xl p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-2 border-blue-400 shadow-sm'
                    : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                }`}
                onClick={() => {
                  if (isSingleVariant && singleVariant) {
                    onToggleItem(svc.id, singleVariant.id);
                  } else if (isSelected && selectedVariantId) {
                    // Header click on selected multi-variant → deselect
                    onToggleItem(svc.id, selectedVariantId);
                  }
                  // Otherwise do nothing; user picks a variant below
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (isSingleVariant && singleVariant) {
                    onToggleItem(svc.id, singleVariant.id);
                  } else if (isSelected && selectedVariantId) {
                    onToggleItem(svc.id, selectedVariantId);
                  }
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{svc.name}</span>
                  {isSelected && (
                    <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                {!isSingleVariant && (
                  <VariantList
                    variants={svc.variants}
                    selectedVariantId={selectedVariantId}
                    onSelect={(vid) => onToggleItem(svc.id, vid)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
```

Key behavioral changes:
- Always show `VariantList` for multi-variant services (no more click-to-expand). Makes multi-select flow one-click.
- For single-variant services: header click toggles directly.
- For multi-variant selected services: clicking the card header deselects.
- Variant clicks always go through `onToggleItem`.

- [ ] **Step 5.8: Verify ServiceGrid typechecks**

```bash
npx tsc --noEmit 2>&1 | grep "ServiceGrid" | head -10
```

Expected: zero errors in `ServiceGrid.tsx`. There will still be errors in `ServiceBlock.tsx` and `MobileServicePicker.tsx` (consumers).

- [ ] **Step 5.9: Commit**

```bash
git add modules/appointments/components/ServiceGrid.tsx
git commit -m "refactor(appointments): ServiceGrid supports multi-select with click-to-toggle"
```

---

## Task 6: Refactor ServiceBlock for multi-item

**Files:**
- Modify: [modules/appointments/components/ServiceBlock.tsx](modules/appointments/components/ServiceBlock.tsx)

**Goal:** Switch to multi-item display, add category lock + "Vider" button, pass through new ServiceGrid props, use block-level summary.

- [ ] **Step 6.1: Update props interface**

Replace the `ServiceBlockProps` interface (lines 11-26) with:

```ts
interface ServiceBlockProps {
  block: ServiceBlockState;
  index: number;
  isActive: boolean;
  services: Service[];
  categories: ServiceCategory[];
  favorites: FavoriteItem[];
  team: StaffMember[];
  onActivate: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<ServiceBlockState>) => void;
  onToggleItem: (serviceId: string, variantId: string) => void;
  onClearItems: () => void;
  summaryText?: string;
  packs?: Pack[];
  onAddPackBlocks?: (pack: Pack) => void;
  stepOffset?: number;
}
```

Removed `onChange` (renamed to `onUpdate` for clarity), added `onToggleItem` and `onClearItems`.

- [ ] **Step 6.2: Update destructured props and imports**

Replace the function signature (lines 28-43) with:

```ts
export default function ServiceBlock({
  block,
  index,
  isActive,
  services,
  categories,
  favorites,
  team,
  onActivate,
  onRemove,
  onUpdate,
  onToggleItem,
  onClearItems,
  summaryText,
  packs = [],
  onAddPackBlocks,
  stepOffset = 0,
}: ServiceBlockProps) {
```

- [ ] **Step 6.3: Replace selected-service derivations**

Replace the `useState` for `activeCategoryId` initial + the two `useMemo` blocks `filteredServices` and `selectedService` (lines 44-68) with:

```ts
  const [activeCategoryId, setActiveCategoryId] = useState<string>(() => {
    // Pack-derived block → keep the user on the Packs tab so the selected pack is visible.
    if (block.packId) return 'PACKS';
    // Otherwise, if the block already has items, open the tab matching the first item's category.
    if (block.items.length > 0) {
      const firstItem = block.items[0];
      const svc = services.find((s) => s.id === firstItem.serviceId);
      if (svc?.categoryId) return svc.categoryId;
    }
    if (block.categoryId) return block.categoryId;
    if (favorites.length > 0) return 'FAVORITES';
    return categories[0]?.id || '';
  });

  const filteredServices = useMemo(
    () =>
      activeCategoryId === 'FAVORITES'
        ? []
        : services.filter((s) => s.categoryId === activeCategoryId && s.active),
    [services, activeCategoryId],
  );

  // Category lock: when items exist (and not a pack block), pills are locked to the active category
  const isLocked = block.items.length > 0 && !block.packId;
```

- [ ] **Step 6.4: Replace category-change and service-selection handlers**

Replace the handlers `handleCategoryChange`, `handleServiceSelect`, `handleVariantSelect` (lines 70-90) with:

```ts
  const handleCategoryChange = (categoryId: string) => {
    // Hard-locked when items exist; only the currently active pill is clickable (as a no-op).
    if (isLocked && categoryId !== activeCategoryId) return;
    setActiveCategoryId(categoryId);
    onUpdate({ categoryId: categoryId === 'FAVORITES' || categoryId === 'PACKS' ? null : categoryId });
  };

  const handleClear = () => {
    onClearItems();
  };

  const handleStaffSelect = (staffId: string | null) => {
    onUpdate({ staffId });
  };
```

- [ ] **Step 6.5: Replace header-info derivations**

Replace the block at lines 96-131 (`variant`, `duration`, `price`, `dateFmt`, `formatBlockDate`, `timeRange`, `serviceInfoBadge`) with:

```ts
  // Block totals (multi-item aware)
  const blockDuration = useMemo(
    () =>
      block.items.reduce((sum, item) => {
        const svc = services.find((s) => s.id === item.serviceId);
        const variant = svc?.variants.find((v) => v.id === item.variantId);
        return sum + (variant?.durationMinutes ?? svc?.durationMinutes ?? 0);
      }, 0),
    [block.items, services],
  );

  const blockPrice = useMemo(
    () =>
      block.items.reduce((sum, item) => {
        const svc = services.find((s) => s.id === item.serviceId);
        const variant = svc?.variants.find((v) => v.id === item.variantId);
        return sum + (item.priceOverride ?? variant?.price ?? svc?.price ?? 0);
      }, 0),
    [block.items, services],
  );

  const firstItemService = useMemo(() => {
    if (block.items.length === 0) return null;
    return services.find((s) => s.id === block.items[0].serviceId) ?? null;
  }, [block.items, services]);

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const formatBlockDate = (dateStr: string) => dateFmt.format(new Date(dateStr + 'T00:00:00'));

  const timeRange = useMemo(() => {
    if (block.hour === null || blockDuration === 0) return null;
    const start = `${block.hour}h${String(block.minute).padStart(2, '0')}`;
    const endTotal = block.hour * 60 + block.minute + blockDuration;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    return `${start} – ${endH}h${String(endM).padStart(2, '0')}`;
  }, [block.hour, block.minute, blockDuration]);

  const headerTitle =
    block.items.length === 0
      ? 'Service'
      : block.items.length === 1
        ? firstItemService?.name ?? 'Service'
        : `${block.items.length} prestations`;

  const serviceInfoBadge = block.items.length > 0 ? (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      {blockDuration > 0 && (
        <span className="flex items-center gap-0.5">
          <Clock size={10} /> {formatDuration(blockDuration)}
        </span>
      )}
      {blockPrice > 0 && <span className="text-blue-600 font-semibold">{formatPrice(blockPrice)}</span>}
      {block.date && (
        <span className="flex items-center gap-0.5">
          <Calendar size={10} /> {formatBlockDate(block.date)}
        </span>
      )}
      {timeRange && <span>{timeRange}</span>}
    </div>
  ) : null;
```

- [ ] **Step 6.6: Update the collapsed-state JSX**

Replace the collapsed-state `return` (lines 134-161) with:

```tsx
  // Collapsed (inactive) state
  if (!isActive) {
    return (
      <div
        className="border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all bg-white"
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onActivate()}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {index + 1 + stepOffset}
            </span>
            <span className="text-slate-700 text-sm font-medium">{headerTitle}</span>
            {serviceInfoBadge}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Supprimer ce service"
          >
            <X size={14} className="text-slate-400" />
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 6.7: Update the expanded-state header**

Replace the expanded-state header div (lines 165-181) with:

```tsx
  // Expanded (active) state
  return (
    <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
            {index + 1 + stepOffset}
          </span>
          <span className="text-slate-900 text-sm font-semibold">{headerTitle}</span>
          {serviceInfoBadge}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-full hover:bg-white/80 flex items-center justify-center flex-shrink-0 transition-colors"
          aria-label="Supprimer ce bloc"
        >
          <X size={14} className="text-slate-400" />
        </button>
      </div>
```

- [ ] **Step 6.8: Update the category pills row with lock behavior + Vider button**

Replace the category pill row (lines 184-234) with:

```tsx
      {/* Category buttons + Vider button when locked */}
      <div className="flex gap-2 flex-wrap mb-3 items-center">
        {favorites.length > 0 && (
          <button
            type="button"
            onClick={() => handleCategoryChange('FAVORITES')}
            disabled={isLocked && activeCategoryId !== 'FAVORITES'}
            aria-disabled={isLocked && activeCategoryId !== 'FAVORITES'}
            className={`
              px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
              ${activeCategoryId === 'FAVORITES'
                ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                : isLocked
                  ? 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
              }
            `}
          >
            <Star size={14} className={activeCategoryId === 'FAVORITES' ? 'fill-amber-400 text-amber-400' : ''} />
            Favoris
          </button>
        )}
        {packs.length > 0 && !isLocked && (
          <button
            type="button"
            onClick={() => handleCategoryChange('PACKS')}
            className={`
              px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
              ${activeCategoryId === 'PACKS'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
              }
            `}
          >
            <Package size={14} />
            Packs
          </button>
        )}
        {categories.map((cat) => {
          const isActivePill = cat.id === activeCategoryId;
          const disabled = isLocked && !isActivePill;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              disabled={disabled}
              aria-disabled={disabled}
              className={`
                px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
                ${isActivePill
                  ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                  : disabled
                    ? 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                }
              `}
            >
              <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={14} className="shrink-0" />
              {cat.name}
            </button>
          );
        })}
        {isLocked && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            Vider
          </button>
        )}
      </div>
```

Note: the `Packs` pill is hidden when `isLocked` — user can't enter packs mode mid-composition. They must Vider first.

- [ ] **Step 6.9: Update the ServiceGrid call**

Replace the `ServiceGrid` invocation (lines 237-247) with:

```tsx
      {/* Service grid */}
      {activeCategoryId !== 'PACKS' && (
        <ServiceGrid
          services={filteredServices}
          favorites={activeCategoryId === 'FAVORITES' ? favorites : []}
          categories={categories}
          selectedItems={block.items}
          onToggleItem={onToggleItem}
        />
      )}
```

- [ ] **Step 6.10: Update the staff pills section**

Replace the staff-pills conditional (lines 278-293) with:

```tsx
      {/* Staff pills (show after at least one item is selected) */}
      {block.items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200/60">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">3</span>
            <span className="text-slate-900 text-sm font-semibold">Praticien</span>
          </div>
          <StaffPills
            team={team}
            categoryId={firstItemService?.categoryId ?? null}
            selectedStaffId={block.staffId}
            onSelect={handleStaffSelect}
            hideLabel
          />
        </div>
      )}
```

- [ ] **Step 6.11: Verify ServiceBlock typechecks**

```bash
npx tsc --noEmit 2>&1 | grep "ServiceBlock" | head -20
```

Expected: zero errors in `ServiceBlock.tsx`. `AppointmentBuilder.tsx` still has errors (consumer).

- [ ] **Step 6.12: Commit**

```bash
git add modules/appointments/components/ServiceBlock.tsx
git commit -m "refactor(appointments): ServiceBlock renders multi-item blocks with category lock and Vider button"
```

---

## Task 7: Update AppointmentBuilder (desktop shell)

**Files:**
- Modify: [modules/appointments/components/AppointmentBuilder.tsx](modules/appointments/components/AppointmentBuilder.tsx):86-104

**Goal:** Pass new props to `ServiceBlock`.

- [ ] **Step 7.1: Update the ServiceBlock invocation**

Replace the `ServiceBlock` JSX (lines 86-104) with:

```tsx
            {form.serviceBlocks.map((block, i) => (
              <ServiceBlock
                key={block.id}
                block={block}
                index={i}
                isActive={i === form.activeBlockIndex}
                services={hookProps.services}
                categories={hookProps.categories}
                favorites={hookProps.favorites ?? []}
                team={hookProps.team}
                packs={hookProps.packs ?? []}
                onAddPackBlocks={form.addPackBlocks}
                onActivate={() => form.setActiveBlockIndex(i)}
                onRemove={() => form.removeBlock(i)}
                onUpdate={(updates) => form.updateBlock(i, updates)}
                onToggleItem={(serviceId, variantId) => form.toggleBlockItem(i, serviceId, variantId)}
                onClearItems={() => form.clearBlockItems(i)}
                summaryText={form.getBlockSummary(block)}
                stepOffset={1}
              />
            ))}
```

- [ ] **Step 7.2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "AppointmentBuilder.tsx" | head -10
```

Expected: zero errors in `AppointmentBuilder.tsx`.

- [ ] **Step 7.3: Commit**

```bash
git add modules/appointments/components/AppointmentBuilder.tsx
git commit -m "refactor(appointments): AppointmentBuilder passes multi-item props to ServiceBlock"
```

---

## Task 8: Update AppointmentSummary

**Files:**
- Modify: [modules/appointments/components/AppointmentSummary.tsx](modules/appointments/components/AppointmentSummary.tsx)

**Goal:** Iterate over `items[]` within each block to build the summary.

- [ ] **Step 8.1: Replace the component**

Replace the entire file [modules/appointments/components/AppointmentSummary.tsx](modules/appointments/components/AppointmentSummary.tsx) with:

```tsx
import React from 'react';
import { formatPrice, formatDuration } from '../../../lib/format';
import type { Service, ServiceBlockItem } from '../../../types';

interface ServiceBlockSummary {
  items: ServiceBlockItem[];
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
}

interface AppointmentSummaryProps {
  serviceBlocks: ServiceBlockSummary[];
  services: Service[];
}

function formatTime(hour: number | null, minute: number, durationMinutes: number): string {
  if (hour === null) return '';
  const start = `${hour}h${String(minute).padStart(2, '0')}`;
  const endTotal = hour * 60 + minute + durationMinutes;
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const end = `${endH}h${String(endM).padStart(2, '0')}`;
  return `${start} – ${end}`;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

function formatBlockDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return dateFmt.format(d);
}

export default function AppointmentSummary({
  serviceBlocks,
  services,
}: AppointmentSummaryProps) {
  // Build one display row per block; multi-item blocks show concatenated service names
  const blockDetails = serviceBlocks.map((block) => {
    const itemDetails = block.items.map((item) => {
      const svc = services.find((s) => s.id === item.serviceId);
      const variant = svc?.variants.find((v) => v.id === item.variantId);
      return {
        name: svc?.name ?? '',
        variantName: variant?.name ?? '',
        duration: variant?.durationMinutes ?? svc?.durationMinutes ?? 0,
        price: item.priceOverride ?? variant?.price ?? svc?.price ?? 0,
      };
    });
    const totalDuration = itemDetails.reduce((sum, i) => sum + i.duration, 0);
    const totalPrice = itemDetails.reduce((sum, i) => sum + i.price, 0);
    const label =
      itemDetails.length === 1
        ? `${itemDetails[0].name}${itemDetails[0].variantName ? ` · ${itemDetails[0].variantName}` : ''}`
        : `${itemDetails.length} prestations : ${itemDetails.map((i) => i.name).join(', ')}`;
    return {
      label,
      duration: totalDuration,
      price: totalPrice,
      date: block.date,
      hour: block.hour,
      minute: block.minute,
    };
  });

  const totalDuration = blockDetails.reduce((sum, b) => sum + b.duration, 0);
  const totalPrice = blockDetails.reduce((sum, b) => sum + b.price, 0);

  if (serviceBlocks.length <= 1) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div className="text-xs text-blue-600 font-semibold mb-3">Total rendez-vous</div>
      <div className="space-y-2">
        {blockDetails.map((b, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                <span className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full inline-flex items-center justify-center text-[10px] font-bold mr-2">{i + 1}</span>
                {b.label}
              </span>
              <span className="text-slate-800 font-medium">{formatPrice(b.price)}</span>
            </div>
            {b.date && b.hour !== null && (
              <div className="text-[11px] text-slate-400 mt-0.5 ml-7">
                {formatBlockDate(b.date)} · {formatTime(b.hour, b.minute, b.duration)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-center">
        <span className="text-sm text-slate-500">Durée : <strong className="text-slate-800">{formatDuration(totalDuration)}</strong></span>
        <strong className="text-blue-600 text-base">{formatPrice(totalPrice)}</strong>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "AppointmentSummary" | head -10
```

Expected: zero errors.

- [ ] **Step 8.3: Commit**

```bash
git add modules/appointments/components/AppointmentSummary.tsx
git commit -m "refactor(appointments): AppointmentSummary iterates over items[] per block"
```

---

## Task 9: Refactor MobileServicePicker to multi-select

**Files:**
- Modify: [modules/appointments/components/MobileServicePicker.tsx](modules/appointments/components/MobileServicePicker.tsx)

**Goal:** Convert to multi-select with internal `selectedItems` state and a "Valider (N)" confirm button. Packs stay atomic (tap-to-close).

- [ ] **Step 9.1: Replace the entire file**

Overwrite [modules/appointments/components/MobileServicePicker.tsx](modules/appointments/components/MobileServicePicker.tsx) with:

```tsx
import React, { useState } from 'react';
import { Check, Star, Package } from 'lucide-react';
import type { Service, ServiceCategory, FavoriteItem, Pack, ServiceBlockItem } from '../../../types';
import { formatPrice, formatDuration } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { getPackDiscount, formatPackItemCount } from '../../services/utils/packExpansion';

interface MobileServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  favorites?: FavoriteItem[];
  packs?: Pack[];
  initialCategoryId: string | null;
  initialItems: ServiceBlockItem[];
  onConfirm: (items: ServiceBlockItem[], categoryId: string | null) => void;
  onPackSelect?: (pack: Pack) => void;
  onClose: () => void;
}

export const MobileServicePicker: React.FC<MobileServicePickerProps> = ({
  services,
  categories,
  favorites = [],
  packs = [],
  initialCategoryId,
  initialItems,
  onConfirm,
  onPackSelect,
  onClose,
}) => {
  const [selectedItems, setSelectedItems] = useState<ServiceBlockItem[]>(initialItems);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => {
    if (initialItems.length > 0) {
      const first = initialItems[0];
      const svc = services.find((s) => s.id === first.serviceId);
      if (svc?.categoryId) return svc.categoryId;
    }
    return favorites.length > 0 ? 'FAVORITES' : initialCategoryId ?? categories[0]?.id ?? null;
  });

  const isLocked = selectedItems.length > 0;

  // When locked, the user is anchored to the category of the first selected item.
  // Compute that category so we can disable sibling pills in the row.
  const lockedCategoryId: string | null = (() => {
    if (!isLocked) return null;
    const firstSvc = services.find((s) => s.id === selectedItems[0].serviceId);
    return firstSvc?.categoryId ?? null;
  })();

  const filteredServices =
    activeCategoryId === 'FAVORITES' || activeCategoryId === 'PACKS' || activeCategoryId === null
      ? []
      : services.filter((s) => s.active && s.categoryId === activeCategoryId);

  const isCategoryPillDisabled = (pillId: string): boolean => {
    if (!isLocked) return false;
    // Favorites stays available as a browsing view only if it matches the locked category scope;
    // for simplicity we keep Favorites enabled only when it was the active tab at lock time.
    if (pillId === activeCategoryId) return false;
    // All other pills (categories + Favorites + Packs) become disabled while locked.
    return true;
  };

  const handleCategoryTap = (categoryId: string) => {
    if (isCategoryPillDisabled(categoryId)) return;
    setActiveCategoryId(categoryId);
  };

  const toggleItem = (serviceId: string, variantId: string) => {
    setSelectedItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.serviceId === serviceId);
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        if (existing.variantId === variantId) {
          // Same variant tapped again → deselect this service
          return prev.filter((_, idx) => idx !== existingIdx);
        }
        // Different variant of already-selected service → replace variantId
        const next = prev.slice();
        next[existingIdx] = { ...existing, variantId };
        return next;
      }
      // New service → append
      return [...prev, { serviceId, variantId }];
    });
  };

  const isServiceSelected = (serviceId: string) =>
    selectedItems.some((i) => i.serviceId === serviceId);

  const getSelectedVariantId = (serviceId: string): string | null =>
    selectedItems.find((i) => i.serviceId === serviceId)?.variantId ?? null;

  const handleClear = () => {
    setSelectedItems([]);
  };

  const handleConfirm = () => {
    let resolvedCategoryId: string | null = null;
    if (selectedItems.length > 0) {
      const firstSvc = services.find((s) => s.id === selectedItems[0].serviceId);
      resolvedCategoryId = firstSvc?.categoryId ?? null;
    }
    onConfirm(selectedItems, resolvedCategoryId);
    onClose();
  };

  const getServiceSubtitle = (service: Service) => {
    const parts: string[] = [];
    if (service.variants.length > 1) {
      parts.push(`${service.variants.length} variantes`);
    }
    const duration = service.durationMinutes ?? service.variants[0]?.durationMinutes;
    if (duration) parts.push(formatDuration(duration));
    const price = service.price ?? service.variants[0]?.price;
    if (price != null) parts.push(formatPrice(price));
    return parts.join(' · ');
  };

  // Render a single regular-service card with toggle + variant expansion
  const renderServiceCard = (service: Service) => {
    const isSelected = isServiceSelected(service.id);
    const selectedVariantId = getSelectedVariantId(service.id);
    const showVariantList = service.variants.length > 1;

    const handleHeaderTap = () => {
      if (service.variants.length === 1) {
        toggleItem(service.id, service.variants[0].id);
        return;
      }
      // Multi-variant: header tap deselects if currently selected; otherwise no-op
      if (isSelected && selectedVariantId) {
        toggleItem(service.id, selectedVariantId);
      }
    };

    return (
      <div key={service.id}>
        <button
          type="button"
          onClick={handleHeaderTap}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl min-h-[52px] transition-colors ${
            isSelected
              ? 'bg-blue-50 border-2 border-blue-400'
              : 'bg-white border border-slate-200'
          }`}
        >
          <div className="text-left">
            <div className="text-sm font-medium text-slate-900">{service.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{getServiceSubtitle(service)}</div>
          </div>
          {isSelected && (
            <Check size={16} className="text-blue-500 shrink-0 ml-2" />
          )}
        </button>

        {showVariantList && (
          <div className="ml-3 mt-2 flex flex-col gap-1.5">
            {service.variants.map((variant) => {
              const variantSelected = selectedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => toggleItem(service.id, variant.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl min-h-[48px] transition-colors ${
                    variantSelected
                      ? 'bg-blue-50 border-2 border-blue-400'
                      : 'bg-white border border-slate-200 active:bg-slate-50'
                  }`}
                >
                  <div className="text-left flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{variant.name}</span>
                    <span className="text-xs text-slate-500">{formatDuration(variant.durationMinutes)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-sm font-semibold text-blue-600">{formatPrice(variant.price)}</span>
                    {variantSelected && <Check size={14} className="text-blue-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render a service-type favorite card (may contain multiple variants)
  const renderFavoriteServiceCard = (service: Service) => {
    const isSelected = isServiceSelected(service.id);
    const selectedVariantId = getSelectedVariantId(service.id);
    const showVariantList = service.variants.length > 1;

    const handleHeaderTap = () => {
      if (service.variants.length === 1) {
        toggleItem(service.id, service.variants[0].id);
        return;
      }
      if (isSelected && selectedVariantId) {
        toggleItem(service.id, selectedVariantId);
      }
    };

    return (
      <div key={`fav-svc-${service.id}`}>
        <button
          type="button"
          onClick={handleHeaderTap}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl min-h-[52px] transition-colors ${
            isSelected
              ? 'bg-blue-50 border-2 border-blue-400'
              : 'bg-white border border-slate-200'
          }`}
        >
          <div className="text-left">
            <div className="text-sm font-medium text-slate-900">{service.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{getServiceSubtitle(service)}</div>
          </div>
          {isSelected && <Check size={16} className="text-blue-500 shrink-0 ml-2" />}
        </button>

        {showVariantList && (
          <div className="ml-3 mt-2 flex flex-col gap-1.5">
            {service.variants.map((variant) => {
              const variantSelected = selectedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => toggleItem(service.id, variant.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl min-h-[48px] transition-colors ${
                    variantSelected
                      ? 'bg-blue-50 border-2 border-blue-400'
                      : 'bg-white border border-slate-200 active:bg-slate-50'
                  }`}
                >
                  <div className="text-left flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{variant.name}</span>
                    <span className="text-xs text-slate-500">{formatDuration(variant.durationMinutes)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-sm font-semibold text-blue-600">{formatPrice(variant.price)}</span>
                    {variantSelected && <Check size={14} className="text-blue-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render a variant-type favorite (single-tap to toggle a specific variant)
  const renderFavoriteVariantCard = (parentService: Service, variant: Service['variants'][number]) => {
    const selected = getSelectedVariantId(parentService.id) === variant.id;
    return (
      <button
        key={`fav-var-${variant.id}`}
        type="button"
        onClick={() => toggleItem(parentService.id, variant.id)}
        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl min-h-[52px] transition-colors ${
          selected
            ? 'bg-blue-50 border-2 border-blue-400'
            : 'bg-white border border-slate-200 active:bg-slate-50'
        }`}
      >
        <div className="text-left">
          <div className="text-sm font-medium text-slate-900">
            {parentService.name} — {variant.name}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {formatDuration(variant.durationMinutes)} · {formatPrice(variant.price)}
          </div>
        </div>
        {selected && <Check size={16} className="text-blue-500 shrink-0 ml-2" />}
      </button>
    );
  };

  const pillBaseClass = 'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors';
  const pillDisabledClass = 'opacity-40';

  return (
    <div className="flex flex-col min-h-full">
      {/* Category pill row */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-5 px-5 scrollbar-hide">
        {favorites.length > 0 && (
          <button
            type="button"
            disabled={isCategoryPillDisabled('FAVORITES')}
            aria-disabled={isCategoryPillDisabled('FAVORITES')}
            onClick={() => handleCategoryTap('FAVORITES')}
            className={`${pillBaseClass} ${
              activeCategoryId === 'FAVORITES'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600'
            } ${isCategoryPillDisabled('FAVORITES') ? pillDisabledClass : ''}`}
          >
            <Star size={14} className={activeCategoryId === 'FAVORITES' ? 'text-white fill-white' : 'text-slate-500'} />
            Favoris
          </button>
        )}
        {packs.length > 0 && !isLocked && (
          <button
            type="button"
            onClick={() => handleCategoryTap('PACKS')}
            className={`${pillBaseClass} ${
              activeCategoryId === 'PACKS'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Package size={14} className={activeCategoryId === 'PACKS' ? 'text-white' : 'text-slate-500'} />
            Packs
          </button>
        )}
        {categories.map((cat) => {
          const disabled = isCategoryPillDisabled(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => handleCategoryTap(cat.id)}
              className={`${pillBaseClass} ${
                activeCategoryId === cat.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600'
              } ${disabled ? pillDisabledClass : ''}`}
            >
              <CategoryIcon
                categoryName={cat.name}
                iconName={cat.icon}
                size={14}
                className={activeCategoryId === cat.id ? 'text-white' : 'text-slate-500'}
              />
              {cat.name}
            </button>
          );
        })}
        {isLocked && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 rounded-full text-xs font-medium text-slate-500 border border-slate-200 bg-white shrink-0 min-h-[36px]"
          >
            Vider
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 pb-4">
        {/* Packs list */}
        {activeCategoryId === 'PACKS' && (
          <div className="flex flex-col gap-2">
            {packs.map((pack) => {
              const discount = getPackDiscount(pack);
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => {
                    onPackSelect?.(pack);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border border-slate-200 min-h-[52px] transition-colors active:bg-emerald-50"
                >
                  <div className="text-left">
                    <div className="text-sm font-medium text-slate-900">{pack.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatPackItemCount(pack)}
                      {discount > 0 && ` · -${discount}%`}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 shrink-0 ml-2">
                    {formatPrice(pack.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Favorites list */}
        {activeCategoryId === 'FAVORITES' && (
          <div className="flex flex-col gap-2">
            {favorites.map((fav) => {
              if (fav.type === 'pack') {
                if (isLocked) return null; // hide pack favorites while locked
                const pack = fav.pack;
                const discount = getPackDiscount(pack);
                return (
                  <button
                    key={`fav-pack-${pack.id}`}
                    type="button"
                    onClick={() => {
                      onPackSelect?.(pack);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border border-slate-200 min-h-[52px] transition-colors active:bg-emerald-50"
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium text-slate-900">{pack.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatPackItemCount(pack)}
                        {discount > 0 && ` · -${discount}%`}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 shrink-0 ml-2">
                      {formatPrice(pack.price)}
                    </span>
                  </button>
                );
              }
              if (fav.type === 'service') {
                // When locked, only show favorites whose category matches the lock
                if (isLocked && lockedCategoryId && fav.service.categoryId !== lockedCategoryId) {
                  return null;
                }
                return renderFavoriteServiceCard(fav.service);
              }
              // Variant-type favorite
              if (isLocked && lockedCategoryId && fav.parentService.categoryId !== lockedCategoryId) {
                return null;
              }
              return renderFavoriteVariantCard(fav.parentService, fav.variant);
            })}
          </div>
        )}

        {/* Regular service list */}
        {activeCategoryId !== 'FAVORITES' && activeCategoryId !== 'PACKS' && (
          <div className="flex flex-col gap-2">
            {filteredServices.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">
                Aucun service dans cette catégorie
              </p>
            )}
            {filteredServices.map(renderServiceCard)}
          </div>
        )}
      </div>

      {/* Sticky confirm bar */}
      <div
        className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 -mx-5"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          disabled={selectedItems.length === 0}
          onClick={handleConfirm}
          className="w-full bg-blue-500 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          Valider ({selectedItems.length})
        </button>
      </div>
    </div>
  );
};
```

This rewrite:
- Switches `onSelect` → `onConfirm(items, categoryId)` and adds `initialItems` prop
- Maintains internal `selectedItems` state (seeded from `initialItems`)
- Adds `isLocked` + `lockedCategoryId` derivations to enforce same-category multi-select
- Disables sibling category pills when locked; hides Packs pill entirely when locked
- Adds a "Vider" button in the pill row when locked (fully clears selection)
- Replaces tap-to-expand with always-visible variant lists on multi-variant services
- Adds a sticky "Valider (N)" bottom bar that calls `onConfirm`
- Packs tab stays atomic (tap-to-close, no multi-select)
- Cancel (backdrop/close) naturally discards internal state since parent state is untouched until `onConfirm` fires

- [ ] **Step 9.2: Verify MobileServicePicker typechecks**

```bash
npx tsc --noEmit 2>&1 | grep "MobileServicePicker" | head -20
```

Expected: zero errors in `MobileServicePicker.tsx`. `AppointmentBuilderMobile.tsx` will still have errors (consumer — fixed in Task 10).

- [ ] **Step 9.3: Commit**

```bash
git add modules/appointments/components/MobileServicePicker.tsx
git commit -m "refactor(appointments): MobileServicePicker becomes multi-select with Valider confirm"
```

---

## Task 10: Update AppointmentBuilderMobile

**Files:**
- Modify: [modules/appointments/components/AppointmentBuilderMobile.tsx](modules/appointments/components/AppointmentBuilderMobile.tsx)

**Goal:** Use `items[]` instead of `serviceId`/`variantId`, show multi-item summaries, wire up `onConfirm` for the multi-select picker.

- [ ] **Step 10.1: Update getBlockService helper**

Replace the `getBlockService` helper (lines 48-55) with a block-aware aggregator:

```ts
  // Build display info for a block's items (multi-item aware)
  const getBlockInfo = (block: { items: Array<{ serviceId: string; variantId: string; priceOverride?: number }> }) => {
    if (block.items.length === 0) return null;
    const details = block.items.map((item) => {
      const svc = hookProps.services.find((s) => s.id === item.serviceId);
      const variant = svc?.variants.find((v) => v.id === item.variantId);
      return {
        service: svc ?? null,
        variant: variant ?? null,
        duration: variant?.durationMinutes ?? svc?.durationMinutes ?? 0,
        price: item.priceOverride ?? variant?.price ?? svc?.price ?? 0,
      };
    });
    const duration = details.reduce((sum, d) => sum + d.duration, 0);
    const price = details.reduce((sum, d) => sum + d.price, 0);
    const primary = details[0];
    const label =
      details.length === 1
        ? `${primary.service?.name ?? ''}`
        : `${details.length} prestations`;
    const subtitle =
      details.length === 1
        ? [primary.variant?.name, formatDuration(duration), formatPrice(price)].filter(Boolean).join(' · ')
        : `${details.map((d) => d.service?.name).filter(Boolean).join(' · ')} · ${formatDuration(duration)} · ${formatPrice(price)}`;
    return { label, subtitle, primaryService: primary.service, firstCategoryId: primary.service?.categoryId ?? null };
  };
```

- [ ] **Step 10.2: Update serviceCount derivation**

Replace the `serviceCount` line (line 58):

```ts
  const serviceCount = form.serviceBlocks.filter((b) => b.items.length > 0).length;
```

- [ ] **Step 10.3: Update the service block rendering in screen 1**

Find the `form.serviceBlocks.map` loop for screen 1 (starts around line 192). Replace its contents with:

```tsx
              {form.serviceBlocks.map((block, i) => {
                const info = getBlockInfo(block);

                if (info) {
                  return (
                    <div key={block.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      {/* Service header */}
                      <div className="px-4 py-3 flex items-start gap-3">
                        <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {info.label}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {info.subtitle}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openServiceSheet(i)}
                            className="text-xs text-blue-600 font-medium px-2 py-1"
                          >
                            Modifier
                          </button>
                          {form.serviceBlocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => form.removeBlock(i)}
                              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                            >
                              <X size={14} className="text-slate-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Staff pills */}
                      <div className="border-t border-slate-100 pt-2 px-4 pb-3">
                        <StaffPills
                          team={hookProps.team}
                          categoryId={info.firstCategoryId}
                          selectedStaffId={block.staffId}
                          onSelect={(staffId) => form.updateBlock(i, { staffId })}
                        />
                      </div>
                    </div>
                  );
                }

                // No items yet
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => openServiceSheet(i)}
                    className="w-full bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 min-h-[52px] hover:border-slate-300 transition-colors"
                  >
                    <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-sm text-slate-400 flex-1 text-left">Choisir un service...</span>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                );
              })}
```

- [ ] **Step 10.4: Update the MobileServicePicker invocation**

Find the `<MobileServicePicker ... />` at the bottom of screen 1 (around line 378) and replace with:

```tsx
          <MobileServicePicker
            services={hookProps.services}
            categories={hookProps.categories}
            favorites={hookProps.favorites}
            packs={hookProps.packs}
            initialCategoryId={form.serviceBlocks[serviceSheetBlockIndex]?.categoryId ?? null}
            initialItems={form.serviceBlocks[serviceSheetBlockIndex]?.items ?? []}
            onConfirm={(items, categoryId) => {
              form.updateBlock(serviceSheetBlockIndex, {
                items,
                categoryId,
              });
            }}
            onPackSelect={(pack) => {
              form.addPackBlocks(pack);
            }}
            onClose={() => setServiceSheetOpen(false)}
          />
```

- [ ] **Step 10.5: Update screen 2 context header (active block info)**

Find the `activeBlockInfo` usage in screen 2 (around line 404). Replace:

```ts
  const activeBlock = form.activeBlock;
  const activeBlockInfo = activeBlock ? getBlockInfo(activeBlock) : null;
```

And in the render of screen 2's context header (around line 482), replace `activeBlockInfo.service.name` with `activeBlockInfo.label`:

```tsx
        {/* Context header */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Planifier</div>
          {activeBlockInfo && (
            <div className="text-sm text-slate-700">
              {activeBlockInfo.label}
              {activeStaffName && (
                <span className="text-slate-400"> &middot; {activeStaffName}</span>
              )}
            </div>
          )}
        </div>
```

- [ ] **Step 10.6: Update block-selector tab strip in screen 2**

Find the `form.serviceBlocks.length > 1` block selector in screen 2 (around line 445). Replace `info?.service.name ?? \`Service ${i + 1}\`` with `info?.label ?? \`Service ${i + 1}\``:

```tsx
                  {info?.label ?? `Service ${i + 1}`}
```

And replace the `getBlockService(block)` call with `getBlockInfo(block)`.

- [ ] **Step 10.7: Update serviceNames footer display in screen 2**

Find the `serviceNames` computation (around line 418):

```ts
  const serviceNames = form.serviceBlocks
    .map((b) => {
      const info = getBlockInfo(b);
      return info?.label;
    })
    .filter(Boolean)
    .join(' + ');
```

- [ ] **Step 10.8: Verify AppointmentBuilderMobile typechecks**

```bash
npx tsc --noEmit 2>&1 | grep "AppointmentBuilderMobile" | head -20
```

Expected: zero errors in `AppointmentBuilderMobile.tsx`.

- [ ] **Step 10.9: Commit**

```bash
git add modules/appointments/components/AppointmentBuilderMobile.tsx
git commit -m "refactor(appointments): AppointmentBuilderMobile consumes items[] and multi-select picker"
```

---

## Task 11: Update AppointmentEditPage with grouping heuristic

**Files:**
- Modify: [modules/appointments/pages/AppointmentEditPage.tsx](modules/appointments/pages/AppointmentEditPage.tsx):40-75

**Goal:** Reconstruct multi-item blocks from DB rows by merging consecutive same-group / same-staff / same-category / back-to-back appointments.

- [ ] **Step 11.1: Replace the editInitialData builder**

Replace the `editInitialData` useMemo (lines 40-75) with:

```ts
  const editInitialData = useMemo(() => {
    if (!selectedAppt) return undefined;

    const groupAppts = selectedAppt.groupId
      ? allAppointments.filter((a) => a.groupId === selectedAppt.groupId)
      : [selectedAppt];

    // Sort chronologically — required for the merge heuristic
    const sorted = [...groupAppts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const serviceBlocks: ServiceBlockState[] = [];
    let current: ServiceBlockState | null = null;
    let currentCursorEnd: Date | null = null;

    for (const appt of sorted) {
      const apptStart = new Date(appt.date);
      const apptEnd = new Date(apptStart.getTime() + (appt.durationMinutes ?? 0) * 60_000);
      const dateStr = `${apptStart.getFullYear()}-${String(apptStart.getMonth() + 1).padStart(2, '0')}-${String(apptStart.getDate()).padStart(2, '0')}`;

      const svc = services.find((s) => s.id === appt.serviceId);
      const variant = appt.variantId
        ? svc?.variants.find((v) => v.id === appt.variantId)
        : svc?.variants.find((v) => v.price === appt.price && v.durationMinutes === appt.durationMinutes);

      const item = {
        serviceId: appt.serviceId ?? '',
        variantId: variant?.id ?? '',
      };

      const canMerge =
        current != null &&
        !current.packId && // pack blocks are atomic
        current.staffId === (appt.staffId ?? null) &&
        current.categoryId === (svc?.categoryId ?? null) &&
        current.date === dateStr &&
        currentCursorEnd != null &&
        currentCursorEnd.getTime() === apptStart.getTime();

      if (canMerge && current) {
        current.items.push(item);
        currentCursorEnd = apptEnd;
      } else {
        current = {
          id: crypto.randomUUID(),
          categoryId: svc?.categoryId ?? null,
          items: [item],
          staffId: appt.staffId ?? null,
          date: dateStr,
          hour: apptStart.getHours(),
          minute: apptStart.getMinutes(),
        };
        serviceBlocks.push(current);
        currentCursorEnd = apptEnd;
      }
    }

    return {
      clientId: selectedAppt.clientId,
      status: selectedAppt.status,
      notes: selectedAppt.notes ?? '',
      reminderMinutes: null as number | null,
      serviceBlocks,
    };
  }, [selectedAppt, allAppointments, services]);
```

- [ ] **Step 11.2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "AppointmentEditPage" | head -10
```

Expected: zero errors in `AppointmentEditPage.tsx`.

- [ ] **Step 11.3: Commit**

```bash
git add modules/appointments/pages/AppointmentEditPage.tsx
git commit -m "feat(appointments): edit mode merges contiguous same-staff same-category appointments into multi-item blocks"
```

---

## Task 12: Full-build verification and manual smoke tests

**Goal:** Confirm the codebase builds cleanly and manually exercise the critical flows.

- [ ] **Step 12.1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: **zero errors.** If any errors remain, fix them in the relevant task file and re-commit with `fix(appointments): ...`.

- [ ] **Step 12.2: Production build**

```bash
npm run build
```

Expected: build succeeds, no new warnings compared to the pre-flight baseline.

- [ ] **Step 12.3: Manual smoke — Desktop create flow**

Start dev server: `npm run dev`. In the browser:

1. Log in and navigate to **Rendez-vous → Nouveau**.
2. Pick a client.
3. In Service 1: pick a category, click a service variant — should appear selected with a checkmark.
4. Click a second service in the same category — should also be selected.
5. Verify block header shows `2 prestations · <duration sum> · <price sum>`.
6. Click the first selected service's card header (multi-variant) or variant (single-variant) — should deselect.
7. Try clicking a different category pill — should be disabled.
8. Click "Vider" — pills re-enable, items cleared.
9. Re-select 2 items, pick a staff, pick a date, pick a time.
10. Verify the time picker's unavailable slots use the **sum** of durations.
11. Save. Confirm toast and redirect to appointment list.
12. In the DB (Supabase Studio or `allAppointments` in query tools), verify 2 rows created with the same `group_id`, sequential `date` values (second's date == first's date + first's duration).

- [ ] **Step 12.4: Manual smoke — Desktop edit flow**

1. From the appointment list, click the group created in Step 12.3 → Modifier.
2. Verify Service 1 opens as **one block with 2 prestations** (the heuristic merged them).
3. Add a third service from the same category — now 3 prestations.
4. Save. Verify the group now has 3 rows.

- [ ] **Step 12.5: Manual smoke — Pack atomicity**

1. New appointment. In Service 1, open the Packs tab and pick a pack.
2. Verify the category pills disappear (pack mode).
3. Verify the "Vider" button is NOT shown.
4. Verify there are N separate blocks (one per pack item), each showing only 1 prestation.
5. Try to add an item to a pack block — it should not be possible.

- [ ] **Step 12.6: Manual smoke — Mobile create flow**

Open the app on a mobile viewport (or DevTools mobile emulation):

1. New appointment. Tap into a service block.
2. `MobileServicePicker` opens. Tap 2 services in the same category.
3. Verify both have checkmarks.
4. Verify "Valider (2)" button at the bottom.
5. Verify other category pills are disabled and a "Vider" button is visible.
6. Tap one selected service again → it deselects. Button becomes "Valider (1)".
7. Tap Valider → sheet closes, block shows `2 prestations · ...`.
8. Continue to screen 2, pick date/time.
9. Save. Verify 2 rows created.

- [ ] **Step 12.7: Manual smoke — Variant replacement**

1. New appointment. Pick a multi-variant service's variant A. Verify it appears in items.
2. Pick variant B of the same service. Verify item count stays at 1, variant updated to B.
3. Pick variant B again. Verify the service is removed (item count 0).

- [ ] **Step 12.8: Manual smoke — Double booking detection**

1. New appointment with 3 services (total 90min) for Staff X at 14:00 on day D.
2. Save.
3. Try to create another appointment for Staff X at 14:30 on day D.
4. Verify the time picker shows 14:00 and surrounding slots as unavailable (because the 90-min block occupies them).

- [ ] **Step 12.9: If any smoke test fails**

Do not skip failures. Create a fix commit for each, tagged as `fix(appointments): <what>`. Re-run all smoke steps after fixes.

- [ ] **Step 12.10: Final commit (if any fixups)**

If the final `tsc` / build / smokes all pass cleanly with no additional fixes, no commit is needed — all feature commits were made per task.

---

## Task 13: Optional cleanup — remove unused props / types

**Goal:** Sweep for any leftover dead code from the refactor.

- [ ] **Step 13.1: Search for stale references**

```bash
npx tsc --noEmit
```

And grep for legacy field names that should no longer exist in the source (outside type definitions of unrelated modules):

Use the Grep tool with pattern `block\.serviceId|block\.variantId|block\.priceOverride` across `modules/appointments/` and `components/` — should return zero matches in active code.

- [ ] **Step 13.2: If anything found, fix and commit**

```bash
git add <files>
git commit -m "chore(appointments): remove stale single-service references"
```

---

## Self-Review (author's notes to implementer)

**Spec coverage map:**

| Spec section | Implementing task |
|---|---|
| §1.1 New ServiceBlockState | Task 1 |
| §1.2 Derived per block | Task 3.3, 3.5, 3.7 |
| §1.3 DB shape unchanged | Task 3.11 (expansion logic) |
| §2.1 Click-to-toggle rules | Task 3.8 (`toggleBlockItem`), Task 5 (ServiceGrid), Task 9 (mobile) |
| §2.2 Category lock + Vider | Task 6.8, Task 9.1 |
| §2.3 Staff picker + availability | Task 3.6 (pass `activeBlockDuration`), Task 6.10 |
| §2.4 Sequential stacking | Task 3.11 (expansion cursor logic) |
| §2.5 Block summary | Task 3.10, Task 6.5 |
| §2.6 Validation | Task 2 |
| §3 Edit-mode heuristic | Task 11 |
| §4.1 types.ts | Task 1 |
| §4.2 schemas.ts | Task 2 |
| §4.3 useAppointmentForm | Task 3 |
| §4.4 ServiceBlock.tsx | Task 6 |
| §4.5 ServiceGrid.tsx | Task 5 |
| §4.6 VariantList.tsx | Task 4 (verified no-op) |
| §4.7 MobileServicePicker.tsx | Task 9 |
| §4.8 AppointmentEditPage.tsx | Task 11 |
| §4.9 Audit consumers of removed fields | Task 7, Task 8, Task 10 |
| §4.10 AppointmentBuilder.tsx | Task 7 |
| §4.11 AppointmentBuilderMobile.tsx | Task 10 |
| §5.1–5.5 Detailed rules | Enforced in Tasks 3, 6, 9 |
| §6 Testing strategy | Task 12 (manual smoke tests) |

**Placeholder scan:** No "TBD", "TODO", or "similar to Task N" placeholders. Every step shows the full code it needs.

**Type/name consistency check:**
- `toggleBlockItem(index, serviceId, variantId)` — same signature in Task 3.4 (interface), 3.8 (impl), 7 (call site), 5/6 (consumers via `onToggleItem`)
- `clearBlockItems(index)` — same in Task 3.4, 3.8, 7
- `activeBlockDuration` / `activeBlockPrice` — defined in Task 3.4, computed in Task 3.5
- `getBlockDuration(block, services)` / `getBlockPrice(block, services)` — module-scoped helpers declared in Task 3.3, consumed in Task 3.5 and 3.7
- `onUpdate` vs `onChange` — Task 6 renames the prop to `onUpdate`; Task 7 passes `onUpdate`. Consistent.
- `MobileServicePicker` prop `onSelect` → `onConfirm` rename — Task 9 defines, Task 10 consumes.
- `initialItems: ServiceBlockItem[]` added in Task 9, passed in Task 10.

No inconsistencies found.
