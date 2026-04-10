# Appointment Form Desktop Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the desktop appointment builder into a 3-zone layout with left sidebar (client+summary), center (services), and right subpanel (staff+calendar), with progressive greying and a visual connector.

**Architecture:** Pure layout/component restructure — no data model or hook changes. AppointmentBuilder gets a new 3-zone JSX structure. StaffPills move out of ServiceBlock into a new StaffCalendarPanel component. The connector is an absolutely-positioned div that tracks the active block's vertical position.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React icons

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `modules/appointments/components/StaffCalendarPanel.tsx` | **Create** | Staff pills + calendar + time picker for active block, with greyed states |
| `modules/appointments/components/AppointmentBuilder.tsx` | **Rewrite** | New 3-zone layout, connector element |
| `modules/appointments/components/ServiceBlock.tsx` | **Modify** | Remove embedded StaffPills section (lines 364-379) |
| `modules/appointments/components/ClientField.tsx` | **Modify** | Change grid from 3-col to phone-full + 2-col names |
| `modules/appointments/components/AppointmentSummary.tsx` | **Modify** | Add empty state, ensure narrow-panel styling |

---

### Task 1: Create StaffCalendarPanel component

**Files:**
- Create: `modules/appointments/components/StaffCalendarPanel.tsx`

- [ ] **Step 1: Create the StaffCalendarPanel component file**

Create `modules/appointments/components/StaffCalendarPanel.tsx` with this content:

```tsx
import React, { useMemo } from 'react';
import type { ServiceBlockState } from '../../../types';
import type { StaffMember, Service } from '../../../types';
import StaffPills from './StaffPills';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';

interface StaffCalendarPanelProps {
  activeBlock: ServiceBlockState | undefined;
  activeBlockIndex: number;
  team: StaffMember[];
  services: Service[];
  unavailableHours: Set<number>;
  onUpdateBlock: (index: number, updates: Partial<ServiceBlockState>) => void;
}

export default function StaffCalendarPanel({
  activeBlock,
  activeBlockIndex,
  team,
  services,
  unavailableHours,
  onUpdateBlock,
}: StaffCalendarPanelProps) {
  const hasService = (activeBlock?.items.length ?? 0) > 0;
  const hasStaff = hasService; // "N'importe qui" (staffId === null) counts as selected when items exist

  // Derive the category from the first item's service for staff filtering
  const firstItemCategoryId = useMemo(() => {
    if (!activeBlock || activeBlock.items.length === 0) return null;
    const svc = services.find((s) => s.id === activeBlock.items[0].serviceId);
    return svc?.categoryId ?? null;
  }, [activeBlock, services]);

  return (
    <div className="space-y-4">
      {/* Step 3 — Praticien */}
      <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">3</span>
          <span className="text-slate-900 text-sm font-semibold">Praticien</span>
        </div>
        <div className="relative">
          <div className={hasService ? '' : 'opacity-40 pointer-events-none'}>
            <StaffPills
              team={team}
              categoryId={firstItemCategoryId}
              selectedStaffId={activeBlock?.staffId ?? null}
              onSelect={(staffId) => onUpdateBlock(activeBlockIndex, { staffId })}
              hideLabel
            />
          </div>
          {!hasService && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium bg-white/80 px-3 py-1.5 rounded-lg shadow-sm">
                Choisissez un service
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Step 4 — Date & Heure */}
      <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">4</span>
          <span className="text-slate-900 text-sm font-semibold">Date & Heure</span>
        </div>
        <div className="relative">
          <div className={hasStaff ? '' : 'opacity-40 pointer-events-none'}>
            <div className="space-y-4">
              <InlineCalendar
                value={activeBlock?.date ?? null}
                onChange={(date) => onUpdateBlock(activeBlockIndex, { date })}
              />
              <TimePicker
                hour={activeBlock?.hour ?? null}
                minute={activeBlock?.minute ?? 0}
                onHourChange={(hour) => onUpdateBlock(activeBlockIndex, { hour })}
                onMinuteChange={(minute) => onUpdateBlock(activeBlockIndex, { minute })}
                unavailableHours={unavailableHours}
                dateSelected={(activeBlock?.date ?? null) !== null}
              />
            </div>
          </div>
          {!hasStaff && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium bg-white/80 px-3 py-1.5 rounded-lg shadow-sm">
                Sélectionnez un praticien
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (component is valid but not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/StaffCalendarPanel.tsx
git commit -m "feat(appointments): add StaffCalendarPanel component

New component rendering Step 3 (staff pills) and Step 4 (calendar + time
picker) for the active service block, with greyed overlay states when
prerequisites are not met."
```

---

### Task 2: Remove StaffPills from ServiceBlock

**Files:**
- Modify: `modules/appointments/components/ServiceBlock.tsx`

- [ ] **Step 1: Remove the StaffPills import and the embedded Step 3 section**

In `modules/appointments/components/ServiceBlock.tsx`:

1. Remove the `StaffPills` import (line 8):
```tsx
// DELETE this line:
import StaffPills from './StaffPills';
```

2. Remove the `team` prop from the interface and destructuring. In `ServiceBlockProps` (line 18), delete:
```tsx
  team: StaffMember[];
```
And remove `team` from the destructured props (line 37):
```tsx
  team,
```
Also remove `StaffMember` from the type imports (line 2) if no longer used in the file.

3. Remove the `handleStaffSelect` function (lines 115-117):
```tsx
// DELETE:
  const handleStaffSelect = (staffId: string | null) => {
    onUpdate({ staffId });
  };
```

4. Remove the entire embedded Step 3 block (lines 364-379):
```tsx
// DELETE this entire block:
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

- [ ] **Step 2: Update AppointmentBuilder to stop passing `team` to ServiceBlock**

In `modules/appointments/components/AppointmentBuilder.tsx`, remove the `team={hookProps.team}` prop from the `<ServiceBlock>` JSX (currently line 112).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/components/ServiceBlock.tsx modules/appointments/components/AppointmentBuilder.tsx
git commit -m "refactor(appointments): extract staff pills from ServiceBlock

Remove embedded Step 3 (StaffPills) from ServiceBlock. Staff selection
now lives in StaffCalendarPanel (Task 1). ServiceBlock focuses on
category pills and service/pack grid only."
```

---

### Task 3: Update ClientField grid layout

**Files:**
- Modify: `modules/appointments/components/ClientField.tsx`

- [ ] **Step 1: Change the new-client form grid from 3-col to phone-full + 2-col names**

In `modules/appointments/components/ClientField.tsx`, replace the grid section (lines 152-222). Change from:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <PhoneInput
            ...
          />
          {/* Phone prefix match dropdown */}
          ...
        </div>

        <div>
          <label ...>Prénom *</label>
          <input ... />
        </div>
        <div>
          <label ...>Nom</label>
          <input ... />
        </div>
      </div>
```

To:

```tsx
      <div className="space-y-3">
        {/* Row 1: Phone (full width) */}
        <div className="relative">
          <PhoneInput
            label="Téléphone"
            required
            value={clientData.phone}
            onChange={(phone) => {
              handleFieldChange({ phone });
              setIsPhoneDropdownOpen(true);
            }}
          />

          {/* Phone prefix match dropdown */}
          {isPhoneDropdownOpen && phoneMatches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-black/5 z-10 max-h-52 overflow-y-auto">
              <div className="px-3 py-2 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <UserCheck size={12} />
                  Clients existants
                </span>
              </div>
              {phoneMatches.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onMouseDown={() => {
                    onSelectClient(client.id);
                    onNewClientChange(null);
                    setIsPhoneDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 flex items-center gap-3 text-sm transition-colors last:rounded-b-xl"
                >
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[11px] font-semibold">
                    {client.firstName?.[0] ?? ''}{client.lastName?.[0] ?? ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-800 font-medium truncate">{[client.firstName, client.lastName].filter(Boolean).join(' ')}</div>
                    <div className="text-slate-400 text-xs">{client.phone ?? ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: First name + Last name (2 columns) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom *</label>
            <input
              type="text"
              value={clientData.firstName}
              onChange={(e) => handleFieldChange({ firstName: e.target.value })}
              onFocus={() => setIsPhoneDropdownOpen(false)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none min-h-[44px] transition-all"
              placeholder="Prénom"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom</label>
            <input
              type="text"
              value={clientData.lastName}
              onChange={(e) => handleFieldChange({ lastName: e.target.value })}
              onFocus={() => setIsPhoneDropdownOpen(false)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none min-h-[44px] transition-all"
              placeholder="Optionnel"
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/ClientField.tsx
git commit -m "refactor(appointments): stack client form for narrow sidebar

Phone input takes full width, first/last name on 2-column row below.
Fits the new 1/4-width left sidebar panel."
```

---

### Task 4: Add empty state to AppointmentSummary

**Files:**
- Modify: `modules/appointments/components/AppointmentSummary.tsx`

- [ ] **Step 1: Update AppointmentSummary to always render**

In `modules/appointments/components/AppointmentSummary.tsx`, replace the early return at line 75:

```tsx
  if (populatedBlocks.length <= 1) return null;
```

With an empty-state card when there are no populated blocks, and a single-block summary when there's exactly one:

```tsx
  // Empty state — always visible per spec
  if (populatedBlocks.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <div className="text-xs text-slate-400 font-medium text-center py-2">
          Commencez par choisir un service
        </div>
      </div>
    );
  }
```

Also remove the `if (populatedBlocks.length <= 1) return null;` guard entirely. The existing render logic already handles 1+ blocks correctly (the `blockDetails.map` loop works for a single block too).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/AppointmentSummary.tsx
git commit -m "feat(appointments): always-visible summary with empty state

Show invitation message when no services selected, full summary for
1+ services. Previously hidden for single-block appointments."
```

---

### Task 5: Rewrite AppointmentBuilder layout

This is the main task. The entire `AppointmentBuilder.tsx` return JSX is restructured.

**Files:**
- Modify: `modules/appointments/components/AppointmentBuilder.tsx`

- [ ] **Step 1: Add imports for the new component and useRef/useEffect**

At the top of `modules/appointments/components/AppointmentBuilder.tsx`, update imports:

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { UseAppointmentFormProps } from '../hooks/useAppointmentForm';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import ClientField from './ClientField';
import ServiceBlock from './ServiceBlock';
import StaffCalendarPanel from './StaffCalendarPanel';
import ReminderToggle from './ReminderToggle';
import AppointmentSummary from './AppointmentSummary';
import { ArrowLeft, Save, Trash2, Plus, Users, StickyNote } from 'lucide-react';
```

Remove imports no longer needed at top level: `InlineCalendar`, `TimePicker`.

- [ ] **Step 2: Add connector logic and refs**

Inside the component body, after the existing state declarations, add:

```tsx
  // Connector: track vertical position of active service block
  const serviceBlockRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rightSubpanelRef = useRef<HTMLDivElement>(null);
  const [connectorTop, setConnectorTop] = useState<number | null>(null);

  const setBlockRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      serviceBlockRefs.current.set(index, el);
    } else {
      serviceBlockRefs.current.delete(index);
    }
  }, []);

  // Recalculate connector position when active block changes
  useEffect(() => {
    const activeEl = serviceBlockRefs.current.get(form.activeBlockIndex);
    if (!activeEl) {
      setConnectorTop(null);
      return;
    }
    const parentEl = activeEl.parentElement?.parentElement; // the right panel wrapper
    if (!parentEl) return;
    const parentRect = parentEl.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    // Center of the active block relative to the right panel wrapper
    setConnectorTop(activeRect.top - parentRect.top + activeRect.height / 2);
  }, [form.activeBlockIndex, form.serviceBlocks.length]);
```

- [ ] **Step 3: Rewrite the return JSX with 3-zone layout**

Replace the entire `return (...)` block with:

```tsx
  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-500" />
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            {form.initialData?.serviceBlocks ? 'Modifier le Rendez-Vous' : 'Nouveau Rendez-Vous'}
          </h1>
        </div>
        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-9 h-9 rounded-xl border border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors"
            >
              <Trash2 size={16} className="text-red-500" />
            </button>
          )}
          <button
            type="button"
            onClick={form.handleSubmit}
            disabled={form.isSaving}
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
          >
            <Save size={15} />
            {form.isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="flex gap-5 max-md:flex-col">
        {/* LEFT SIDEBAR — 1/4 */}
        <div className="flex-[1] space-y-4 max-md:order-first">
          {/* Step 1 — Client */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">1</span>
                  <span className="text-slate-900 text-sm font-semibold">Client</span>
                </div>
                {!form.clientId && !showExistingClientSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowExistingClientSearch(true);
                      form.setNewClient(null);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Users size={12} />
                    Client existant
                  </button>
                )}
              </div>
              <ClientField
                clients={hookProps.clients}
                selectedClientId={form.clientId}
                onSelectClient={(id) => { form.setClientId(id); form.setNewClient(null); form.clearFieldError('clientId'); }}
                onClearClient={() => form.setClientId(null)}
                newClientData={form.newClient}
                onNewClientChange={form.setNewClient}
                error={form.errors.clientId}
                showExistingSearch={showExistingClientSearch}
                onShowExistingSearchChange={setShowExistingClientSearch}
              />
            </div>
          </div>

          {/* Total Summary — always visible */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <AppointmentSummary
              serviceBlocks={form.serviceBlocks}
              services={hookProps.services}
            />
          </div>

          {/* Rappel + Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <ReminderToggle value={form.reminderMinutes} onChange={form.setReminderMinutes} />

            {/* Notes — toggleable */}
            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <StickyNote size={14} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Notes</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showNotes;
                    setShowNotes(next);
                    if (!next) form.setNotes('');
                  }}
                  className={`w-10 h-[22px] rounded-full relative transition-colors ${showNotes ? 'bg-blue-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all shadow-sm ${showNotes ? 'right-[2px]' : 'left-[2px]'}`} />
                </button>
              </div>
              {showNotes && (
                <textarea
                  value={form.notes}
                  onChange={(e) => form.setNotes(e.target.value)}
                  placeholder="Ajouter des notes..."
                  rows={3}
                  className="mt-3 w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none min-h-[44px] transition-all"
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT AREA — 3/4 */}
        <div className="flex-[3] relative">
          <div className="flex gap-5 max-[1200px]:flex-col">
            {/* Services subpanel — 2/3 */}
            <div className="flex-[2] space-y-3">
              {form.serviceBlocks.map((block, i) => (
                <div key={block.id} ref={(el) => setBlockRef(i, el)}>
                  <ServiceBlock
                    block={block}
                    index={i}
                    isActive={i === form.activeBlockIndex}
                    services={hookProps.services}
                    categories={hookProps.categories}
                    favorites={hookProps.favorites ?? []}
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
                </div>
              ))}

              {/* Add service button */}
              <button
                type="button"
                onClick={form.addBlock}
                className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3.5 text-slate-400 text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Ajouter un service
              </button>
            </div>

            {/* Connector line — hidden on stacked layout */}
            {connectorTop !== null && (
              <div
                className="absolute w-5 border-t-2 border-blue-400 max-[1200px]:hidden"
                style={{
                  top: connectorTop,
                  left: 'calc(66.666% - 10px)',
                  transition: 'top 200ms ease',
                }}
              />
            )}

            {/* Staff + Calendar subpanel — 1/3 */}
            <div className="flex-[1]" ref={rightSubpanelRef}>
              <div className="sticky top-4">
                <StaffCalendarPanel
                  activeBlock={form.activeBlock}
                  activeBlockIndex={form.activeBlockIndex}
                  team={hookProps.team}
                  services={hookProps.services}
                  unavailableHours={form.unavailableHours}
                  onUpdateBlock={form.updateBlock}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Verify the dev server renders without errors**

Run: `npm run dev` (should already be running)
Navigate to the appointment creation page in the browser. Verify:
- Left sidebar shows Client card, empty Total Summary ("Commencez par choisir un service"), Rappel, Notes
- Center shows the service block(s) + "Ajouter un service" button
- Right shows Step 3 (greyed "Choisissez un service") and Step 4 (greyed "Sélectionnez un praticien")
- Selecting a service un-greys Step 3 (staff pills)
- Selecting any staff option (including "N'importe qui") un-greys Step 4 (calendar)
- A blue connector line links the active block to the right subpanel
- The connector animates vertically when switching between multiple blocks

- [ ] **Step 6: Commit**

```bash
git add modules/appointments/components/AppointmentBuilder.tsx
git commit -m "feat(appointments): 3-zone desktop layout with connector

Reorganize AppointmentBuilder into left sidebar (1/4: client, summary,
toggles), center (services), and right subpanel (1/3: staff + calendar).
Blue connector line tracks the active service block. Progressive greying
on steps 3 and 4 until prerequisites are met."
```

---

### Task 6: Responsive breakpoint and polish

**Files:**
- Modify: `modules/appointments/components/AppointmentBuilder.tsx`

- [ ] **Step 1: Verify the `max-[1200px]:flex-col` breakpoint works**

Resize the browser to below 1200px. The inner right area should stack vertically: services full-width, then staff+calendar below. The connector line should be hidden.

If the stacking works correctly, no code change is needed — the Tailwind arbitrary breakpoint `max-[1200px]:flex-col` handles it.

- [ ] **Step 2: Verify mobile shell is unaffected**

Resize the browser to mobile width (<768px). Verify that `AppointmentBuilderMobile` renders (not the desktop shell). The mobile shell has its own layout and should be completely unchanged.

- [ ] **Step 3: Test the edit flow**

Navigate to edit an existing appointment. Verify:
- Client shows as selected chip
- Service blocks load with their saved items
- Staff shows as selected in StaffCalendarPanel for the active block
- Calendar shows the saved date
- Switching between blocks updates the right subpanel

- [ ] **Step 4: Fine-tune connector positioning if needed**

The connector's `left` position uses `calc(66.666% - 10px)` to align with the 2/3 split point. If it doesn't align perfectly with the gap between the services column and the staff column, adjust the calc value. The connector should bridge the gap between the two columns.

If the connector position needs adjustment, update the `left` style value in the connector div.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix(appointments): polish connector position and responsive layout"
```

Only create this commit if changes were made in steps 1-4. If everything worked on first try, skip this commit.
