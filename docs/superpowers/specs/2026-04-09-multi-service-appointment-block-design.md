# Multi-Service Appointment Block — Design

**Date:** 2026-04-09
**Scope:** Appointment form (desktop + mobile)
**Type:** UX + frontend-only refactor (no DB changes)

## Motivation

Today, each "service block" in the appointment form holds exactly one service + variant. A client who books **cut + color + blow-dry** (one stylist, same category, back-to-back) must create three separate blocks and re-pick the stylist each time. This is the most common real-world flow in a salon and the current UX punishes it.

We want a single "Service 1" block to hold **multiple services/variants from the same category**, sharing one staff member and one start time, with items stacking sequentially in time.

## Goals

- Allow click-to-toggle multi-selection of services/variants within a block
- Enforce the "same category per block" constraint (it matches how stylists specialize)
- Share staff, date, and start time across all items in a block
- Sum durations and prices at the block level
- Expand a block into N individual appointment rows on submit (no DB changes)
- Preserve multi-item grouping across edit cycles
- Desktop and mobile surfaces both updated

## Non-goals

- DB migrations (no new columns, no new tables)
- Calendar rendering changes (N rows still render as N adjacent blocks)
- Packs behavior changes (packs stay atomic; see §5.2)
- Drag-reorder of items within a block (insertion order wins)
- Cross-category blocks
- Auto-grouping of unrelated appointments (grouping only runs within an existing `appointment_groups.id`)

---

## 1. Data model (frontend only)

### 1.1 New `ServiceBlockState`

```ts
export interface ServiceBlockItem {
  serviceId: string;
  variantId: string;
  priceOverride?: number;
}

export interface ServiceBlockState {
  id: string;
  categoryId: string | null;
  items: ServiceBlockItem[];      // 1..N, replaces serviceId/variantId/priceOverride
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
  packId?: string;                // when set, block is atomic (see §5.2)
}
```

A single-service block is `items.length === 1`. A pack-derived block is a block with `items.length === 1` and `packId` set. The data model is one shape; behavior differences are constrained to the UI layer.

### 1.2 Derived per block

- `blockDuration(block) = sum(items[i].effectiveDuration)`
- `blockPrice(block) = sum(items[i].priceOverride ?? variant.price ?? service.price)`
- `blockEnd(block) = blockStart + blockDuration`

Where `effectiveDuration` is `variant.durationMinutes ?? service.durationMinutes ?? 30`.

### 1.3 DB shape — unchanged

The `onSave` payload keeps its existing flat shape: `serviceBlocks: Array<{ serviceId, variantId, staffId, date, durationMinutes, price }>`. The expansion from `items[]` to flat rows happens in `useAppointmentForm.handleSubmit`. Both `addAppointmentGroupMutation` and `editAppointmentGroupMutation` / `edit_appointment_group` RPC are untouched.

---

## 2. UX rules

### 2.1 Click-to-toggle selection

- **Unselected service, single variant:** click adds `{serviceId, variantId}` to `items[]`
- **Unselected service, multi-variant:** click **expands** the variant list (does not add yet); clicking a variant adds it
- **Selected service, click a different variant:** replace the variant for that service
- **Selected service, click the same variant:** remove the service from `items[]`
- **Selected single-variant service, click the card again:** remove from `items[]`

**Invariant:** each `serviceId` appears at most once in a block's `items[]`. Two haircut variants for the same client is nonsensical; forcing uniqueness prevents nonsense state.

### 2.2 Same-category lock

- While `items.length > 0` and `!packId`, **category pills are visually disabled** except the currently active one.
- A small **"Vider"** (clear) button appears adjacent to the active pill.
- Clicking "Vider" clears `items[]` (and resets any item-specific state), re-enabling all pills.
- Switching category without clearing is forbidden — prevents accidental destructive changes.

### 2.3 Staff picker

- One staff picker per block (unchanged from today)
- Still appears only after `items.length > 0`
- Staff change is free — doesn't affect items
- Availability (`useStaffAvailability`) uses `blockDuration` as `durationMinutes`

### 2.4 Scheduling (Option A — sequential stacking)

- One start time per block: `(date, hour, minute)`
- Items expand back-to-back on submit:
  - `item[0].start = blockStart`
  - `item[i].start = item[i-1].start + item[i-1].duration`
- The `TimePicker` displays slot availability computed against `blockDuration` (the full stacked window)
- Insertion order is preserved; no drag-reorder

### 2.5 Block header/summary

**Expanded state header:**
```
[#n] [CategoryName] · [N prestations] · [totalDuration] · [totalPrice]   [×]
```

**Collapsed state:**
```
[#n] [CategoryName]  •  [N prestations] · [duration] · [price]  •  [StaffFirstName L.]  [×]
```

(`•` separators, truncation with ellipsis on narrow screens. For `N === 1` we can optionally show the single service name instead of `"1 prestation"` — implementation detail.)

### 2.6 Validation

- Block is valid if: `items.length >= 1` AND all items have `serviceId` + `variantId` AND `staffId != null` AND `date != null` AND `hour != null`
- Zod schema updated accordingly (§4.2)

---

## 3. Edit-mode grouping heuristic

### 3.1 The problem

`appointment_groups` already exists in DB. Editing an appointment loads **all sibling rows with the same `group_id`** into the form as separate blocks. Post-feature, a user who created a 3-item block will see 3 separate single-item blocks on edit — a UX regression that silently breaks their mental model.

### 3.2 The heuristic

When `AppointmentEditPage` builds `initialData.serviceBlocks`, merge consecutive appointments that all satisfy:

1. **Same `group_id`** (the DB-level anchor — we never merge across groups)
2. **Same `staffId`**
3. **Same `categoryId`** (resolved from `services.category_id`)
4. **Contiguous times:** `appt[i+1].date == appt[i].date + appt[i].durationMinutes` (in the same local day)

Run the scan in chronological order (sort by `date` ASC first). Consecutive appointments meeting all four conditions merge into one block with `items[]` in chronological order. Any break (different staff, different category, time gap) starts a new block.

### 3.3 Safety argument

- The `group_id` constraint is critical: we only merge things that were already saved together as a group. We never invent groupings from unrelated appointments.
- Same-staff + same-category + back-to-back times is a near-zero false-positive signal. Two unrelated services for the same stylist in the same category at exactly contiguous times is effectively only going to happen if they were part of the same visit.
- Worst case: a false merge can be un-merged manually by the user (clicking to remove items). No data loss.

### 3.4 Pack blocks skip the heuristic

Appointments with a non-null `packId` (reconstructed from the group's pack items) are never candidates for merging with non-pack items. Pack blocks stay atomic and single-item on edit — matching §5.2.

---

## 4. Files changed

### 4.1 `types.ts`

Update `ServiceBlockState` to the shape in §1.1. Remove `serviceId`, `variantId`, and top-level `priceOverride`. Add `items: ServiceBlockItem[]`. Keep `packId`.

### 4.2 `modules/appointments/schemas.ts`

Replace `serviceBlockSchema`:

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
  hour: z.number().min(0).max(23, "L'heure doit être entre 0 et 23"),
  minute: z.number().refine((m) => [0, 15, 30, 45].includes(m), {
    message: 'Les minutes doivent être 00, 15, 30 ou 45',
  }),
});
```

`appointmentGroupSchema` stays unchanged structurally — it still references `serviceBlockSchema`.

### 4.3 `modules/appointments/hooks/useAppointmentForm.ts`

Core refactor. Changes:

- **State shape:** `serviceBlocks` now holds the new `ServiceBlockState` (items array). `createEmptyBlock()` returns `{ ..., items: [], ... }`.
- **Remove** `activeVariant` and `activeService` from the return value — no longer meaningful at the block level. Audit consumers (§4.9).
- **Add derived:**
  - `activeBlockItems: ServiceBlockItem[]` — from `activeBlock.items`
  - `blockDuration(block)` helper (exported or co-located)
  - `blockPrice(block)` helper
- **`effectiveDuration`:** replaced by `activeBlock`'s `blockDuration`. Used by `useStaffAvailability` and TimePicker.
- **New action `toggleBlockItem(blockIndex, serviceId, variantId)`** implementing the rules in §2.1:
  - If `items.find(i => i.serviceId === serviceId)` exists:
    - If its `variantId === variantId` → remove the item
    - Else → replace the item's `variantId`
  - Else → append `{ serviceId, variantId }`
- **New action `clearBlockItems(blockIndex)`** for the "Vider" button.
- **`addPackBlocks`:** updated to create blocks in the new shape. Each pack item still becomes its own block (packs stay N-blocks); each has `items: [{ serviceId, variantId, priceOverride }]` and `packId` set.
- **`totalDuration` / `totalPrice`:** iterate over `serviceBlocks[*].items[*]` instead of per-block single service.
- **`hasCompleteServiceBlock`:** `serviceBlocks.some(b => b.items.length > 0)`.
- **`allBlocksScheduled`:** requires `items.length > 0 && date && hour !== null` per block.
- **`getBlockSummary`:** builds the multi-item summary string (`"N prestations · duration · price · staff"` or `"serviceName · variant · duration · price · staff"` when N === 1).
- **`handleSubmit` expansion logic:** for each block, expand `items[]` into N flat payload entries:
  ```ts
  let cursorStart = blockLocalDateTime(block);  // Date object at block start
  for (const item of block.items) {
    const svc = services.find(s => s.id === item.serviceId);
    const variant = svc?.variants.find(v => v.id === item.variantId);
    const duration = variant?.durationMinutes ?? svc?.durationMinutes ?? 30;
    payloadBlocks.push({
      serviceId: item.serviceId,
      variantId: item.variantId,
      staffId: block.staffId,
      date: cursorStart.toISOString(),
      durationMinutes: duration,
      price: item.priceOverride ?? variant?.price ?? svc?.price ?? 0,
    });
    cursorStart = new Date(cursorStart.getTime() + duration * 60_000);
  }
  ```
- **`initialData.serviceBlocks` shape:** callers pass the new shape. `AppointmentEditPage` applies the heuristic before passing (§4.8).

### 4.4 `modules/appointments/components/ServiceBlock.tsx`

- Replace single-selection props/state with multi-select via `toggleBlockItem`.
- Remove the `onClick={() => !isSelected && onSelect...}` guard so a second click can fire.
- Category pills: disable (visually, not keyboard-inaccessible — just grayed + `aria-disabled`) when `items.length > 0 && !packId`. Active pill stays interactive as a no-op.
- Render "Vider" button adjacent to the active pill when locked. Clicking calls `clearBlockItems`.
- Block header: render the multi-item summary per §2.5.
- Pack blocks: hide category pills entirely (PACKS tab remains active as today). "Vider" button hidden for pack blocks. Items list is read-only.
- Staff picker appears once `items.length > 0`.
- Remove `selectedService` / `variant` / `duration` / `price` locals that assume single-service. Compute from block aggregates.

### 4.5 `modules/appointments/components/ServiceGrid.tsx`

New props (replace `selectedServiceId` / `selectedVariantId` / `onSelectService` / `onSelectVariant`):

```ts
interface ServiceGridProps {
  services: Service[];
  favorites?: FavoriteItem[];
  categories?: ServiceCategory[];
  selectedItems: ServiceBlockItem[];
  onToggleItem: (serviceId: string, variantId: string) => void;
}
```

Render changes:

- `isSelected` per service = `selectedItems.some(i => i.serviceId === svc.id)`
- `selectedVariantId` per service = `selectedItems.find(i => i.serviceId === svc.id)?.variantId ?? null`
- **Remove the `!isSelected` click guard** on both the `<div>` onClick handlers and the `onKeyDown` handlers. A second click on a selected card must fire `onToggleItem`.
- Multi-variant services: clicking the card expands the variant list as today, but the card is "selected" only when an actual variant is in `selectedItems`. The VariantList's selected highlight reflects the currently stored variant for that service.
- Favorites grid mirrors the same toggle behavior for both `type === 'service'` and `type === 'variant'` favorites.
- Single-variant services: click directly toggles that one variant.

### 4.6 `modules/appointments/components/VariantList.tsx`

Called by `ServiceGrid`. Ensure clicking the currently selected variant still fires the callback (for deselection). Likely a small change: remove any `selectedVariantId === variant.id ? null : onSelect` guard if present.

### 4.7 `modules/appointments/components/MobileServicePicker.tsx`

Convert to multi-select mode:

- Replace `onSelect(selection)` auto-close with `onToggle(serviceId, variantId)` + explicit confirm button.
- Internal state `selectedItems: ServiceBlockItem[]` seeded from `initialItems` prop (passed in by the mobile shell).
- Category pills: same "locked when non-empty" behavior as desktop. Include a "Vider" control.
- Bottom sticky bar: **"Valider ({N})"** button. Disabled when `N === 0`.
- Cancel (closing the sheet without Valider) discards changes; the block's prior `items[]` is preserved.
- To fully clear a block's items, the user uses the block header's "Vider" control on mobile screen 1 (the same pattern as desktop), or removes the block entirely via its X button.
- Tap on service card: same toggle rules as desktop.
- On "Valider": call `onConfirm(items)` then close. The parent replaces the block's `items[]` with the returned array.
- Favorites + regular services: same multi-select treatment.
- Packs tab behavior: unchanged. Tapping a pack still triggers `onPackSelect(pack)` and closes (packs are atomic).

### 4.8 `modules/appointments/pages/AppointmentEditPage.tsx`

`editInitialData` builder change. After loading `groupAppts` (same `group_id`), sort by `date` ASC, then reduce into blocks using the heuristic from §3.2:

```ts
const serviceBlocks: ServiceBlockState[] = [];
let current: ServiceBlockState | null = null;

for (const appt of sortedGroupAppts) {
  const svc = services.find(s => s.id === appt.serviceId);
  const variant = /* existing variant resolution logic */;
  const apptDate = new Date(appt.date);
  const dateStr = formatLocalDate(apptDate);

  const item: ServiceBlockItem = {
    serviceId: appt.serviceId!,
    variantId: variant?.id ?? '',
    // priceOverride only if pack-derived (detect via packId on appt if available)
  };

  const canMerge =
    current != null &&
    !current.packId &&                              // packs stay atomic
    current.staffId === appt.staffId &&
    current.categoryId === (svc?.categoryId ?? null) &&
    current.date === dateStr &&
    isContiguous(current, apptDate);                // cursor end == appt start

  if (canMerge) {
    current!.items.push(item);
  } else {
    current = {
      id: crypto.randomUUID(),
      categoryId: svc?.categoryId ?? null,
      items: [item],
      staffId: appt.staffId ?? null,
      date: dateStr,
      hour: apptDate.getHours(),
      minute: apptDate.getMinutes(),
      // packId: ... (if the appointment belongs to a pack item)
    };
    serviceBlocks.push(current);
  }
}
```

`isContiguous` computes the current block's cursor end (block start + sum of existing items' durations) and checks strict equality with the incoming appointment's start. No tolerance — reconstruction is exact or we start a new block.

If the DB schema doesn't currently track per-appointment `packId`, pack reconstruction on edit stays as-is (pack blocks won't be mergeable because they're treated as their own single-item blocks). This is fine — users editing a pack still see it correctly; the heuristic just skips them.

### 4.9 Consumers of removed `activeVariant` / `activeService`

Audit required during implementation. Likely sites:

- `AppointmentBuilder.tsx` — desktop shell
- `AppointmentBuilderMobile.tsx` — mobile shell
- `SchedulingPanel.tsx` — for duration/price summary in the scheduling panel
- Any summary/preview component that reads from the form hook's return

Each needs to switch from `activeVariant`/`activeService` to `activeBlock.items` + `blockDuration(activeBlock)` + `blockPrice(activeBlock)`.

### 4.10 `modules/appointments/components/AppointmentBuilder.tsx` (desktop shell)

Passes new props through to `ServiceBlock`:
- `onToggleItem` → wired to `toggleBlockItem(index, ...)`
- `onClearItems` → wired to `clearBlockItems(index)`

Removes references to removed derivations.

### 4.11 `modules/appointments/components/AppointmentBuilderMobile.tsx` (mobile shell)

- Opens `MobileServicePicker` with the block's current `items[]` as `initialItems`.
- On confirm, replaces the block's `items[]` via `updateBlock(index, { items: returned })`.
- Summary line in the mobile screen 1 for each service block uses `getBlockSummary` (now multi-item aware).

### 4.12 Schema: zod still matches flat payload

`appointmentSchema` (the legacy single-appointment schema) stays as-is — it's used elsewhere and unrelated.

---

## 5. Detailed rules catalog

### 5.1 Same-service duplication

Not allowed. Each `serviceId` appears at most once per block. Clicking a different variant of an already-selected service **replaces**, it doesn't append a duplicate.

### 5.2 Pack blocks are atomic

- `block.packId != null` implies:
  - `items.length === 1` always
  - No add/remove/replace of items
  - Category pills hidden (PACKS tab stays as the single visual context)
  - No "Vider" button
  - `toggleBlockItem` is a no-op on pack blocks (defensive — UI shouldn't allow the call anyway)
- To mix a pack service with a regular service, users create a separate block.
- Rationale: pack items carry pro-rata `priceOverride` that only makes sense within the pack's total; mixing breaks that invariant.

### 5.3 Sequential time stacking

- One `(hour, minute)` per block — user picks once.
- Items stack back-to-back in insertion order on submit.
- Availability check (`useStaffAvailability`) runs against the full stacked duration (sum).
- Reordering items is **not** a v1 feature. If the user wants a different order, they remove and re-add.

### 5.4 Empty blocks

- A block with `items.length === 0` is **invalid** at submit time.
- A freshly added block starts empty; the form allows it in-progress but `allBlocksScheduled` and the submit validator reject it.
- Collapsing an empty block shows a placeholder like `"Service"` (as today).

### 5.5 Edit-mode heuristic scope

- Runs **only** inside the same `group_id`.
- Respects same-staff, same-category, back-to-back-time invariants.
- Pack-derived appointments skip the merge (atomic by §5.2).
- No tolerance window on "back-to-back" — exact equality of `prev.end == next.start`. Rounding errors are impossible because durations are integers in minutes.

---

## 6. Testing strategy

- **Unit: `useAppointmentForm`**
  - `toggleBlockItem`: add, replace variant, remove variant (deselect), reject duplicate serviceId
  - `addPackBlocks`: produces atomic pack blocks in new shape
  - `clearBlockItems`: resets to empty, category still set
  - `handleSubmit` expansion: 3-item block → 3 payload entries with sequential ISO dates, correct durations and prices
  - Multi-block form: mixed single + multi + pack blocks expand correctly
- **Unit: edit-mode heuristic in `AppointmentEditPage`**
  - 3 contiguous same-staff same-category rows → merges into one block
  - 2 contiguous then 1 with different staff → 2 blocks (merge, single)
  - Contiguous but different category → 2 blocks
  - Gap in time (even 1 minute) → 2 blocks
  - Pack row in the middle → pack stays separate; non-pack neighbors don't merge across it
  - Single appointment → 1 block with 1 item (baseline)
- **Integration (manual):**
  - Create: pick 3 services in one block → save → confirm 3 rows in DB with correct `group_id`, times, prices
  - Edit: open the same group → confirm 1 merged block restored → add a 4th service → save → 4 rows
  - Pack: pick a pack → confirm N atomic blocks, category pills hidden, can't add items
  - Switch category lock: pick 2 services → try switching category → pills disabled + "Vider" visible → click "Vider" → pills enabled → pick new category
  - Staff availability: 3-service block (total 90min) → time picker correctly blocks 90-min windows that overlap other appointments
  - Double-booking constraint: two blocks in the same form both try to use 14:00 on same staff → error surfaces

---

## 7. Rollout plan

Single PR. No feature flag needed — the change is frontend-only and backwards-compatible at the DB layer. Existing appointments continue to load correctly (via the heuristic, or as single-item blocks if they don't meet merge criteria).

## 8. Open questions (low priority, not blockers)

- **Per-item remove from a multi-item block UI affordance:** should removing the last item also remove the block, or leave an empty block for the user to refill? **Decision:** leave empty — matches current behavior where a block persists until explicitly X'd out.
- **Visual calendar merging:** future polish. Today's calendar will render a 3-item block as 3 adjacent rectangles. Acceptable for v1.
