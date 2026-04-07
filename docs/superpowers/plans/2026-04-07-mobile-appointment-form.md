# Mobile Appointment Form Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dramatically improve the mobile UX of the appointment form with a native-app-feel hybrid two-screen flow, bottom sheets, and shared form logic hook.

**Architecture:** Extract all form state/logic from `AppointmentBuilder.tsx` into a `useAppointmentForm` hook. Desktop shell keeps current layout via that hook. New mobile shell renders a two-screen flow (client+services, then scheduling) with bottom sheet pickers. A new reusable `MobileBottomSheet` component powers the pickers.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React icons, Zod validation, TanStack Query (existing hooks)

**Spec:** `docs/superpowers/specs/2026-04-07-mobile-appointment-form-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `modules/appointments/hooks/useAppointmentForm.ts` | NEW — all form state, derived values, actions, validation, submit logic |
| `modules/appointments/components/AppointmentBuilder.tsx` | MODIFIED — desktop rendering shell, calls `useAppointmentForm` |
| `modules/appointments/components/MobileBottomSheet.tsx` | NEW — reusable portal bottom sheet with drag, backdrop, scroll lock |
| `modules/appointments/components/MobileClientSearch.tsx` | NEW — client search/create bottom sheet content |
| `modules/appointments/components/MobileServicePicker.tsx` | NEW — service+variant picker bottom sheet content |
| `modules/appointments/components/AppointmentBuilderMobile.tsx` | NEW — mobile two-screen shell |
| `modules/appointments/pages/AppointmentNewPage.tsx` | MODIFIED — isMobile routing to mobile/desktop shell |
| `modules/appointments/pages/AppointmentEditPage.tsx` | MODIFIED — isMobile routing to mobile/desktop shell |

---

### Task 1: Extract useAppointmentForm Hook

**Files:**
- Create: `modules/appointments/hooks/useAppointmentForm.ts`
- Modify: `modules/appointments/components/AppointmentBuilder.tsx`

- [ ] **Step 1: Create the hook file**

Create `modules/appointments/hooks/useAppointmentForm.ts` with all state and logic extracted from `AppointmentBuilder.tsx`:

```typescript
import { useState, useCallback, useMemo } from 'react';
import type {
  Appointment,
  AppointmentStatus,
  ServiceBlockState,
  Service,
  ServiceCategory,
  StaffMember,
  Client,
} from '../../../types';
import { appointmentGroupSchema, newClientSchema } from '../schemas';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { useStaffAvailability } from './useStaffAvailability';
import { formatPrice } from '../../../lib/format';

function createEmptyBlock(): ServiceBlockState {
  return {
    id: crypto.randomUUID(),
    categoryId: null,
    serviceId: null,
    variantId: null,
    staffId: null,
    date: null,
    hour: null,
    minute: 0,
  };
}

export interface UseAppointmentFormProps {
  services: Service[];
  categories: ServiceCategory[];
  team: StaffMember[];
  clients: Client[];
  appointments: Appointment[];
  onSave: (payload: {
    clientId: string;
    newClient: { firstName: string; lastName: string; phone: string } | null;
    notes: string;
    reminderMinutes: number | null;
    status: string;
    serviceBlocks: Array<{
      serviceId: string;
      variantId: string;
      staffId: string | null;
      date: string;
      durationMinutes: number;
      price: number;
    }>;
  }) => Promise<void> | void;
  excludeAppointmentIds?: string[];
  initialData?: {
    clientId: string;
    status: AppointmentStatus;
    notes: string;
    reminderMinutes: number | null;
    serviceBlocks: ServiceBlockState[];
  };
}

export function useAppointmentForm({
  services,
  categories,
  team,
  clients,
  appointments,
  onSave,
  excludeAppointmentIds,
  initialData,
}: UseAppointmentFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [clientId, setClientId] = useState<string | null>(initialData?.clientId ?? null);
  const [newClient, setNewClient] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);
  const [serviceBlocks, setServiceBlocks] = useState<ServiceBlockState[]>(
    initialData?.serviceBlocks ?? [createEmptyBlock()],
  );
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [status, setStatus] = useState<AppointmentStatus>(
    initialData?.status ?? ('SCHEDULED' as AppointmentStatus),
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    initialData?.reminderMinutes ?? null,
  );

  const { errors, validate, clearFieldError } = useFormValidation(appointmentGroupSchema);

  const activeBlock = serviceBlocks[activeBlockIndex];
  const activeStaff = useMemo(
    () => team.find((m) => m.id === activeBlock?.staffId) ?? null,
    [team, activeBlock?.staffId],
  );
  const activeVariant = useMemo(() => {
    if (!activeBlock?.serviceId || !activeBlock?.variantId) return null;
    const svc = services.find((s) => s.id === activeBlock.serviceId);
    return svc?.variants.find((v) => v.id === activeBlock.variantId) ?? null;
  }, [services, activeBlock?.serviceId, activeBlock?.variantId]);
  const activeService = useMemo(
    () => services.find((s) => s.id === activeBlock?.serviceId) ?? null,
    [services, activeBlock?.serviceId],
  );
  const effectiveDuration = activeVariant?.durationMinutes ?? activeService?.durationMinutes ?? 30;

  const availabilityAppointments = useMemo(() => {
    if (!excludeAppointmentIds || excludeAppointmentIds.length === 0) return appointments;
    const excludeSet = new Set(excludeAppointmentIds);
    return appointments.filter(a => !excludeSet.has(a.id));
  }, [appointments, excludeAppointmentIds]);

  const unavailableHours = useStaffAvailability(
    activeStaff,
    activeBlock?.date ?? null,
    effectiveDuration,
    availabilityAppointments,
  );

  const updateBlock = useCallback((index: number, updates: Partial<ServiceBlockState>) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...updates } : b)),
    );
  }, []);

  const removeBlock = useCallback((index: number) => {
    setServiceBlocks((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setActiveBlockIndex((prev) => {
      if (index < prev) return prev - 1;
      if (index === prev) return Math.max(0, prev - 1);
      return prev;
    });
  }, []);

  const addBlock = useCallback(() => {
    setServiceBlocks((prev) => {
      const newBlock = createEmptyBlock();
      const lastBlock = prev[prev.length - 1];
      if (lastBlock?.date) {
        newBlock.date = lastBlock.date;
      }
      return [...prev, newBlock];
    });
    setServiceBlocks((prev) => {
      setActiveBlockIndex(prev.length - 1);
      return prev;
    });
  }, []);

  const getBlockSummary = useCallback((block: ServiceBlockState): string => {
    const svc = services.find((s) => s.id === block.serviceId);
    const variant = svc?.variants.find((v) => v.id === block.variantId);
    const staff = team.find((m) => m.id === block.staffId);
    const duration = variant?.durationMinutes ?? svc?.durationMinutes;
    const price = variant?.price ?? svc?.price;
    const parts = [
      svc?.name,
      variant ? `· ${variant.name}` : null,
      duration ? `· ${duration}m` : null,
      price != null ? `· ${formatPrice(price)}` : null,
      staff ? `· ${staff.firstName}${staff.lastName ? ` ${staff.lastName[0]}.` : ''}` : null,
    ].filter(Boolean);
    return parts.join(' ');
  }, [services, team]);

  const handleSubmit = useCallback(async () => {
    const effectiveClientId = newClient ? 'pending-new-client' : (clientId ?? '');

    const formData = {
      clientId: effectiveClientId,
      serviceBlocks: serviceBlocks.map((b) => ({
        serviceId: b.serviceId ?? '',
        variantId: b.variantId ?? '',
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

    if (newClient) {
      const clientResult = newClientSchema.safeParse(newClient);
      if (!clientResult.success) return;
    }

    const payload = {
      clientId: clientId ?? '',
      newClient,
      notes,
      reminderMinutes,
      status,
      serviceBlocks: serviceBlocks.map((b) => {
        const svc = services.find((s) => s.id === b.serviceId);
        const variant = svc?.variants.find((v) => v.id === b.variantId);
        const dateStr = b.date ?? '';
        const hour = b.hour ?? 0;
        const minute = b.minute;
        const [year, month, day] = dateStr.split('-').map(Number);
        const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
        const isoDate = localDate.toISOString();

        return {
          serviceId: b.serviceId ?? '',
          variantId: b.variantId ?? '',
          staffId: b.staffId,
          date: isoDate,
          durationMinutes: variant?.durationMinutes ?? svc?.durationMinutes ?? 30,
          price: variant?.price ?? svc?.price ?? 0,
        };
      }),
    };

    setIsSaving(true);
    try {
      await onSave(payload);
    } catch {
      // Error handled by caller's onError
    } finally {
      setIsSaving(false);
    }
  }, [clientId, newClient, serviceBlocks, status, notes, reminderMinutes, validate, onSave, services]);

  // Computed totals for summary
  const totalDuration = useMemo(() => {
    return serviceBlocks.reduce((sum, b) => {
      const svc = services.find(s => s.id === b.serviceId);
      const variant = svc?.variants.find(v => v.id === b.variantId);
      return sum + (variant?.durationMinutes ?? svc?.durationMinutes ?? 0);
    }, 0);
  }, [serviceBlocks, services]);

  const totalPrice = useMemo(() => {
    return serviceBlocks.reduce((sum, b) => {
      const svc = services.find(s => s.id === b.serviceId);
      const variant = svc?.variants.find(v => v.id === b.variantId);
      return sum + (variant?.price ?? svc?.price ?? 0);
    }, 0);
  }, [serviceBlocks, services]);

  // Check if at least one block has a service+variant selected (for "Continuer" button)
  const hasCompleteServiceBlock = serviceBlocks.some(b => b.serviceId && b.variantId);

  // Check if all blocks have date+time (for "Confirmer" button)
  const allBlocksScheduled = serviceBlocks.every(b => b.serviceId && b.variantId && b.date && b.hour !== null);

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
    // Derived
    activeBlock,
    activeStaff,
    activeVariant,
    activeService,
    effectiveDuration,
    unavailableHours,
    totalDuration,
    totalPrice,
    hasCompleteServiceBlock,
    allBlocksScheduled,
    // Validation
    errors,
    // Actions
    setClientId,
    setNewClient,
    setServiceBlocks,
    setActiveBlockIndex,
    setStatus,
    setNotes,
    setReminderMinutes,
    updateBlock,
    removeBlock,
    addBlock,
    getBlockSummary,
    handleSubmit,
    clearFieldError,
    // Data (pass-through for convenience)
    services,
    categories,
    team,
    clients,
  };
}

export type AppointmentFormReturn = ReturnType<typeof useAppointmentForm>;
```

- [ ] **Step 2: Refactor AppointmentBuilder to use the hook**

Replace `AppointmentBuilder.tsx` — remove all state/logic, import and call `useAppointmentForm`. The JSX stays identical. Only the state declarations and handler definitions are removed (replaced by destructuring from the hook).

The full file after refactoring:

```typescript
import React from 'react';
import type { AppointmentStatus, ServiceBlockState } from '../../../types';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import type { UseAppointmentFormProps } from '../hooks/useAppointmentForm';
import ClientField from './ClientField';
import ServiceBlock from './ServiceBlock';
import SchedulingPanel from './SchedulingPanel';
import AppointmentSummary from './AppointmentSummary';
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react';

interface AppointmentBuilderProps extends UseAppointmentFormProps {
  onCancel: () => void;
  onDelete?: () => void;
}

export default function AppointmentBuilder({
  onCancel,
  onDelete,
  ...hookProps
}: AppointmentBuilderProps) {
  const form = useAppointmentForm(hookProps);

  return (
    <div className="flex gap-5 max-md:flex-col">
      {/* LEFT PANEL */}
      <div className="flex-[1.3] bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={18} className="text-slate-500" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900">
              {hookProps.initialData ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
            </h3>
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
              className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <Save size={15} />
              {form.isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {/* Client */}
        <ClientField
          clients={form.clients}
          selectedClientId={form.clientId}
          onSelectClient={(id) => { form.setClientId(id); form.setNewClient(null); form.clearFieldError('clientId'); }}
          onClearClient={() => form.setClientId(null)}
          newClientData={form.newClient}
          onNewClientChange={form.setNewClient}
          error={form.errors.clientId}
        />

        <div className="border-t border-slate-100 mb-5" />

        {/* Service blocks */}
        <div className="space-y-3 mb-4">
          {form.serviceBlocks.map((block, i) => (
            <ServiceBlock
              key={block.id}
              block={block}
              index={i}
              isActive={i === form.activeBlockIndex}
              services={form.services}
              categories={form.categories}
              team={form.team}
              onActivate={() => form.setActiveBlockIndex(i)}
              onRemove={() => form.removeBlock(i)}
              onChange={(updates) => form.updateBlock(i, updates)}
              summaryText={form.getBlockSummary(block)}
            />
          ))}
        </div>

        {/* Add service button */}
        <button
          type="button"
          onClick={form.addBlock}
          className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3.5 text-slate-400 text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 mb-5"
        >
          <Plus size={16} /> Ajouter un service
        </button>

        {/* Notes */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Notes</div>
          <textarea
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            placeholder="Ajouter des notes..."
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none min-h-[44px] transition-all"
          />
        </div>

        {/* Total Summary */}
        {form.serviceBlocks.length > 0 && (
          <div className="mt-4">
            <AppointmentSummary
              serviceBlocks={form.serviceBlocks}
              services={form.services}
            />
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-[0.6]">
        <SchedulingPanel
          activeDate={form.activeBlock?.date ?? null}
          activeHour={form.activeBlock?.hour ?? null}
          activeMinute={form.activeBlock?.minute ?? 0}
          onDateChange={(date) => form.updateBlock(form.activeBlockIndex, { date })}
          onHourChange={(hour) => form.updateBlock(form.activeBlockIndex, { hour })}
          onMinuteChange={(minute) => form.updateBlock(form.activeBlockIndex, { minute })}
          status={form.status}
          onStatusChange={form.setStatus}
          reminderMinutes={form.reminderMinutes}
          onReminderChange={form.setReminderMinutes}
          unavailableHours={form.unavailableHours}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify desktop still works**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/hooks/useAppointmentForm.ts modules/appointments/components/AppointmentBuilder.tsx
git commit -m "refactor: extract useAppointmentForm hook from AppointmentBuilder"
```

---

### Task 2: Create MobileBottomSheet Component

**Files:**
- Create: `modules/appointments/components/MobileBottomSheet.tsx`

- [ ] **Step 1: Create the bottom sheet component**

```typescript
import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function MobileBottomSheet({ isOpen, onClose, title, children }: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const [expanded, setExpanded] = React.useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current;
    currentY.current = delta;
    if (sheetRef.current && delta > 0) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
    // Drag down past 100px threshold -> close
    if (currentY.current > 100) {
      onClose();
      setExpanded(false);
    }
    // Drag up past 50px threshold -> expand
    else if (currentY.current < -50 && !expanded) {
      setExpanded(true);
    }
    currentY.current = 0;
  }, [onClose, expanded]);

  // Reset expanded when closed
  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const height = expanded ? '90vh' : '50vh';

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal, 60)' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl transition-[height] duration-300 ease-out flex flex-col"
        style={{ height }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        {/* Title */}
        {title && (
          <div className="px-5 pb-3 shrink-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          </div>
        )}
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/MobileBottomSheet.tsx
git commit -m "feat: add MobileBottomSheet component for appointment mobile UI"
```

---

### Task 3: Create MobileClientSearch Component

**Files:**
- Create: `modules/appointments/components/MobileClientSearch.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Client } from '../../../types';
import { PhoneInput } from '../../../components/PhoneInput';
import { Search, UserPlus, Check } from 'lucide-react';

interface MobileClientSearchProps {
  clients: Client[];
  onSelectClient: (clientId: string) => void;
  onNewClient: (data: { firstName: string; lastName: string; phone: string }) => void;
  onClose: () => void;
}

export default function MobileClientSearch({
  clients,
  onSelectClient,
  onNewClient,
  onClose,
}: MobileClientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus search input on mount
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const list = term
      ? clients.filter(
          (c) =>
            c.firstName.toLowerCase().includes(term) ||
            c.lastName.toLowerCase().includes(term) ||
            c.phone?.toLowerCase().includes(term),
        )
      : clients;
    return list.slice(0, 30);
  }, [clients, searchTerm]);

  const handleSelect = (clientId: string) => {
    onSelectClient(clientId);
    onClose();
  };

  const handleCreate = () => {
    if (!firstName.trim()) return;
    onNewClient({ firstName: firstName.trim(), lastName: lastName.trim(), phone });
    onClose();
  };

  if (isCreating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <UserPlus size={14} className="text-blue-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900">Nouveau client</span>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Prenom *</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Prenom"
            autoFocus
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none min-h-[48px] transition-all"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nom</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Optionnel"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none min-h-[48px] transition-all"
          />
        </div>
        <PhoneInput
          label="Telephone *"
          value={phone}
          onChange={setPhone}
          required
        />
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!firstName.trim()}
            className="flex-1 bg-blue-500 text-white py-3 rounded-xl text-sm font-medium min-h-[48px] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Ajouter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-4">
        <input
          ref={searchRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un client..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pl-10 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none min-h-[48px] transition-all"
        />
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Client list */}
      <div className="space-y-1 mb-4">
        {filteredClients.map((client) => {
          const initials = `${client.firstName?.[0] ?? ''}${client.lastName?.[0] ?? ''}`.toUpperCase();
          return (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelect(client.id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-blue-50 active:bg-blue-100 transition-colors min-h-[52px]"
            >
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {[client.firstName, client.lastName].filter(Boolean).join(' ')}
                </div>
                {client.phone && (
                  <div className="text-xs text-slate-400 truncate">{client.phone}</div>
                )}
              </div>
            </button>
          );
        })}
        {filteredClients.length === 0 && searchTerm && (
          <div className="text-center py-6 text-sm text-slate-400">Aucun client trouve</div>
        )}
      </div>

      {/* New client button */}
      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all min-h-[48px]"
      >
        <UserPlus size={16} />
        Nouveau client
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/MobileClientSearch.tsx
git commit -m "feat: add MobileClientSearch bottom sheet content component"
```

---

### Task 4: Create MobileServicePicker Component

**Files:**
- Create: `modules/appointments/components/MobileServicePicker.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState, useMemo } from 'react';
import type { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { Check } from 'lucide-react';

interface MobileServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  initialCategoryId: string | null;
  onSelect: (selection: { serviceId: string; variantId: string; categoryId: string }) => void;
  onClose: () => void;
}

export default function MobileServicePicker({
  services,
  categories,
  initialCategoryId,
  onSelect,
  onClose,
}: MobileServicePickerProps) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    initialCategoryId || categories[0]?.id || '',
  );
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  const filteredServices = useMemo(
    () => services.filter((s) => s.categoryId === activeCategoryId && s.active),
    [services, activeCategoryId],
  );

  const handleServiceTap = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc) return;
    // If only one variant, auto-select it
    if (svc.variants.length === 1) {
      onSelect({
        serviceId: svc.id,
        variantId: svc.variants[0].id,
        categoryId: activeCategoryId,
      });
      onClose();
      return;
    }
    // Otherwise expand to show variants
    setExpandedServiceId(expandedServiceId === serviceId ? null : serviceId);
  };

  const handleVariantSelect = (serviceId: string, variantId: string) => {
    onSelect({ serviceId, variantId, categoryId: activeCategoryId });
    onClose();
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  };

  return (
    <div>
      {/* Category pills — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-5 px-5 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => { setActiveCategoryId(cat.id); setExpandedServiceId(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 min-h-[36px] ${
              cat.id === activeCategoryId
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={13} className="shrink-0" />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="space-y-2">
        {filteredServices.map((svc) => {
          const isExpanded = svc.id === expandedServiceId;
          return (
            <div key={svc.id}>
              <button
                type="button"
                onClick={() => handleServiceTap(svc.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all min-h-[52px] ${
                  isExpanded
                    ? 'bg-blue-50 border-2 border-blue-400'
                    : 'bg-white border border-slate-200 active:bg-slate-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{svc.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {svc.variants.length} variante{svc.variants.length > 1 ? 's' : ''} · {formatDuration(svc.durationMinutes)} · {formatPrice(svc.price)}
                  </div>
                </div>
              </button>
              {/* Variants */}
              {isExpanded && (
                <div className="mt-1 ml-3 space-y-1">
                  {svc.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleVariantSelect(svc.id, v.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-150 active:bg-blue-50 transition-all min-h-[48px]"
                    >
                      <div>
                        <span className="text-sm text-slate-700">{v.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{formatDuration(v.durationMinutes)}</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{formatPrice(v.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredServices.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400">Aucun service dans cette categorie</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/MobileServicePicker.tsx
git commit -m "feat: add MobileServicePicker bottom sheet content component"
```

---

### Task 5: Create AppointmentBuilderMobile Component

**Files:**
- Create: `modules/appointments/components/AppointmentBuilderMobile.tsx`

This is the main mobile shell — the largest task. It renders a two-screen flow using the shared hook.

- [ ] **Step 1: Create the mobile builder**

```typescript
import React, { useState, useMemo } from 'react';
import type { AppointmentStatus } from '../../../types';
import type { UseAppointmentFormProps } from '../hooks/useAppointmentForm';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import { formatPrice } from '../../../lib/format';
import MobileBottomSheet from './MobileBottomSheet';
import MobileClientSearch from './MobileClientSearch';
import MobileServicePicker from './MobileServicePicker';
import StaffPills from './StaffPills';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';
import ReminderToggle from './ReminderToggle';
import { ArrowLeft, Trash2, Search, X, Plus, ChevronRight } from 'lucide-react';

const STATUS_OPTIONS: { value: AppointmentStatus; label: string; color: string }[] = [
  { value: 'SCHEDULED' as AppointmentStatus, label: 'Planifie', color: 'bg-blue-500' },
  { value: 'IN_PROGRESS' as AppointmentStatus, label: 'En cours', color: 'bg-violet-500' },
  { value: 'COMPLETED' as AppointmentStatus, label: 'Complete', color: 'bg-green-500' },
  { value: 'CANCELLED' as AppointmentStatus, label: 'Annule', color: 'bg-red-500' },
  { value: 'NO_SHOW' as AppointmentStatus, label: 'Absent', color: 'bg-orange-500' },
];

interface AppointmentBuilderMobileProps extends UseAppointmentFormProps {
  onCancel: () => void;
  onDelete?: () => void;
}

export default function AppointmentBuilderMobile({
  onCancel,
  onDelete,
  ...hookProps
}: AppointmentBuilderMobileProps) {
  const form = useAppointmentForm(hookProps);

  const [screen, setScreen] = useState<'services' | 'scheduling'>('services');
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [serviceSheetBlockIndex, setServiceSheetBlockIndex] = useState(0);

  const selectedClient = useMemo(
    () => form.clients.find((c) => c.id === form.clientId),
    [form.clients, form.clientId],
  );

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  };

  const completedBlocksCount = form.serviceBlocks.filter(b => b.serviceId && b.variantId).length;

  // Summary text for footer
  const summaryText = completedBlocksCount > 0
    ? `${completedBlocksCount} service${completedBlocksCount > 1 ? 's' : ''} · ${formatDuration(form.totalDuration)} · ${formatPrice(form.totalPrice)}`
    : '';

  // Full summary for scheduling footer
  const schedulingSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedClient) {
      parts.push(selectedClient.firstName);
    } else if (form.newClient) {
      parts.push(form.newClient.firstName);
    }
    const serviceNames = form.serviceBlocks
      .map(b => form.services.find(s => s.id === b.serviceId)?.name)
      .filter(Boolean);
    if (serviceNames.length > 0) parts.push(serviceNames.join(' + '));

    const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    const dates = form.serviceBlocks
      .filter(b => b.date)
      .map(b => dateFmt.format(new Date(b.date! + 'T00:00:00')));
    if (dates.length > 0) parts.push(dates[0]);

    if (form.totalPrice > 0) parts.push(formatPrice(form.totalPrice));
    return parts.join(' · ');
  }, [selectedClient, form.newClient, form.serviceBlocks, form.services, form.totalPrice]);

  const openServiceSheet = (blockIndex: number) => {
    setServiceSheetBlockIndex(blockIndex);
    setServiceSheetOpen(true);
  };

  // =============================================
  // SCREEN 2: SCHEDULING
  // =============================================
  if (screen === 'scheduling') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={() => setScreen('services')}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h2 className="text-base font-semibold text-slate-900 flex-1">Quand ?</h2>
        </div>

        <div className="flex-1 overflow-y-auto pb-32">
          {/* Block selector pills (if multiple blocks) */}
          {form.serviceBlocks.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
              {form.serviceBlocks.map((block, i) => {
                const svc = form.services.find(s => s.id === block.serviceId);
                const isActive = i === form.activeBlockIndex;
                const hasSchedule = block.date && block.hour !== null;
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => form.setActiveBlockIndex(i)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all min-h-[36px] ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-sm'
                        : hasSchedule
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {i + 1}
                    </span>
                    {svc?.name ?? 'Service'}
                  </button>
                );
              })}
            </div>
          )}

          {/* Context: what service we're scheduling */}
          <div className="px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">Planifier</div>
            <div className="text-sm font-semibold text-slate-800">
              {form.activeService?.name ?? 'Service'}{' '}
              {form.activeStaff && (
                <span className="text-slate-400 font-normal">
                  · {form.activeStaff.firstName}
                </span>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div className="px-4 mb-4">
            <div className="text-xs font-medium text-slate-500 mb-2">Date *</div>
            <InlineCalendar
              value={form.activeBlock?.date ?? null}
              onChange={(date) => form.updateBlock(form.activeBlockIndex, { date })}
            />
          </div>

          {/* Time Picker */}
          <div className="px-4 mb-4">
            <div className="text-xs font-medium text-slate-500 mb-2">Heure *</div>
            <TimePicker
              hour={form.activeBlock?.hour ?? null}
              minute={form.activeBlock?.minute ?? 0}
              onHourChange={(hour) => form.updateBlock(form.activeBlockIndex, { hour })}
              onMinuteChange={(minute) => form.updateBlock(form.activeBlockIndex, { minute })}
              unavailableHours={form.unavailableHours}
              dateSelected={form.activeBlock?.date !== null}
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 space-y-2 z-10">
          {schedulingSummary && (
            <div className="text-xs text-slate-500 text-center truncate px-2">{schedulingSummary}</div>
          )}
          <button
            type="button"
            onClick={form.handleSubmit}
            disabled={!form.allBlocksScheduled || form.isSaving}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-colors min-h-[52px] flex items-center justify-center gap-2 shadow-sm"
          >
            {form.isSaving ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </div>
      </div>
    );
  }

  // =============================================
  // SCREEN 1: CLIENT + SERVICES + OPTIONS
  // =============================================
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h2 className="text-base font-semibold text-slate-900">
            {hookProps.initialData ? 'Modifier le RDV' : 'Nouveau RDV'}
          </h2>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="w-10 h-10 rounded-xl border border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* CLIENT SECTION */}
        <div className="px-4 pt-4 pb-3">
          <div className="text-xs font-medium text-slate-500 mb-2">Client *</div>
          {selectedClient ? (
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                  {`${selectedClient.firstName?.[0] ?? ''}${selectedClient.lastName?.[0] ?? ''}`.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {[selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(' ')}
                  </div>
                  {selectedClient.phone && (
                    <div className="text-xs text-slate-400">{selectedClient.phone}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => form.setClientId(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>
          ) : form.newClient ? (
            <div className="bg-blue-50/50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xs font-semibold">
                    {form.newClient.firstName?.[0]?.toUpperCase() ?? ''}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-blue-800">
                    {[form.newClient.firstName, form.newClient.lastName].filter(Boolean).join(' ')}
                  </div>
                  <div className="text-xs text-blue-500">Nouveau client</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => form.setNewClient(null)}
                className="w-8 h-8 rounded-full hover:bg-white/80 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setClientSheetOpen(true)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left hover:border-blue-300 active:bg-slate-50 transition-all min-h-[52px]"
            >
              <Search size={16} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-400">Rechercher un client...</span>
            </button>
          )}
          {form.errors.clientId && (
            <p className="text-red-500 text-xs mt-1.5">{form.errors.clientId}</p>
          )}
        </div>

        <div className="mx-4 border-t border-slate-100" />

        {/* SERVICE BLOCKS */}
        <div className="px-4 pt-3 pb-2">
          <div className="text-xs font-medium text-slate-500 mb-2">Services *</div>
          <div className="space-y-3">
            {form.serviceBlocks.map((block, i) => {
              const svc = form.services.find(s => s.id === block.serviceId);
              const variant = svc?.variants.find(v => v.id === block.variantId);
              const staff = form.team.find(m => m.id === block.staffId);
              const duration = variant?.durationMinutes ?? svc?.durationMinutes;
              const price = variant?.price ?? svc?.price;

              return (
                <div key={block.id}>
                  {/* Service card */}
                  {svc ? (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">{svc.name}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                              {variant && <span>{variant.name}</span>}
                              {duration != null && <span>{formatDuration(duration)}</span>}
                              {price != null && <span className="text-blue-600 font-semibold">{formatPrice(price)}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openServiceSheet(i)}
                            className="text-xs text-blue-500 font-medium px-2 py-1"
                          >
                            Modifier
                          </button>
                          {form.serviceBlocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => form.removeBlock(i)}
                              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
                            >
                              <X size={14} className="text-slate-400" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Staff pills below service */}
                      {block.serviceId && (
                        <div className="px-4 pb-3 border-t border-slate-100 pt-2">
                          <StaffPills
                            team={form.team}
                            categoryId={svc.categoryId ?? null}
                            selectedStaffId={block.staffId}
                            onSelect={(staffId) => form.updateBlock(i, { staffId })}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Empty block — tap to select service */
                    <button
                      type="button"
                      onClick={() => openServiceSheet(i)}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 flex items-center gap-3 hover:border-blue-300 active:bg-slate-50 transition-all min-h-[52px]"
                    >
                      <span className="bg-slate-200 text-slate-500 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-400">Choisir un service...</span>
                      <ChevronRight size={16} className="text-slate-300 ml-auto" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add service button */}
          <button
            type="button"
            onClick={form.addBlock}
            className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3.5 text-slate-400 text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 mt-3"
          >
            <Plus size={16} /> Ajouter un service
          </button>
        </div>

        <div className="mx-4 border-t border-slate-100 my-2" />

        {/* OPTIONS: Status, Notes, Reminder */}
        <div className="px-4 pb-4 space-y-4">
          {/* Status */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Statut</div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => form.setStatus(opt.value)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[36px] ${
                    form.status === opt.value
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Notes</div>
            <textarea
              value={form.notes}
              onChange={(e) => form.setNotes(e.target.value)}
              placeholder="Ajouter des notes..."
              rows={2}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none min-h-[48px] transition-all"
            />
          </div>

          {/* Reminder */}
          <ReminderToggle
            value={form.reminderMinutes}
            onChange={form.setReminderMinutes}
          />
        </div>
      </div>

      {/* STICKY FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 space-y-2 z-10">
        {summaryText && (
          <div className="text-xs text-slate-500 text-center">{summaryText}</div>
        )}
        <button
          type="button"
          onClick={() => setScreen('scheduling')}
          disabled={!form.hasCompleteServiceBlock}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-colors min-h-[52px] flex items-center justify-center gap-2 shadow-sm"
        >
          Continuer
          <ChevronRight size={18} />
        </button>
      </div>

      {/* BOTTOM SHEETS */}
      <MobileBottomSheet
        isOpen={clientSheetOpen}
        onClose={() => setClientSheetOpen(false)}
        title="Client"
      >
        <MobileClientSearch
          clients={form.clients}
          onSelectClient={(id) => {
            form.setClientId(id);
            form.setNewClient(null);
            form.clearFieldError('clientId');
          }}
          onNewClient={(data) => {
            form.setNewClient(data);
            form.setClientId(null);
            form.clearFieldError('clientId');
          }}
          onClose={() => setClientSheetOpen(false)}
        />
      </MobileBottomSheet>

      <MobileBottomSheet
        isOpen={serviceSheetOpen}
        onClose={() => setServiceSheetOpen(false)}
        title="Service"
      >
        <MobileServicePicker
          services={form.services}
          categories={form.categories}
          initialCategoryId={form.serviceBlocks[serviceSheetBlockIndex]?.categoryId ?? null}
          onSelect={({ serviceId, variantId, categoryId }) => {
            form.updateBlock(serviceSheetBlockIndex, { serviceId, variantId, categoryId });
          }}
          onClose={() => setServiceSheetOpen(false)}
        />
      </MobileBottomSheet>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/components/AppointmentBuilderMobile.tsx
git commit -m "feat: add AppointmentBuilderMobile two-screen form shell"
```

---

### Task 6: Wire Up Page Components

**Files:**
- Modify: `modules/appointments/pages/AppointmentNewPage.tsx`
- Modify: `modules/appointments/pages/AppointmentEditPage.tsx`

- [ ] **Step 1: Update AppointmentNewPage**

Replace `modules/appointments/pages/AppointmentNewPage.tsx`:

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { supabase } from '../../../lib/supabase';
import AppointmentBuilder from '../components/AppointmentBuilder';
import AppointmentBuilderMobile from '../components/AppointmentBuilderMobile';

export const AppointmentNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const { isMobile } = useMediaQuery();
  const { allAppointments, addAppointmentGroup } = useAppointments();
  const { allClients: clients } = useClients();
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  const handleSave = async (payload: Parameters<typeof addAppointmentGroup>[0] & { newClient: { firstName: string; lastName: string; phone: string } | null }) => {
    if (payload.newClient && activeSalon) {
      const { data: newClientRow, error: clientError } = await supabase
        .from('clients')
        .insert({
          salon_id: activeSalon.id,
          first_name: payload.newClient.firstName,
          last_name: payload.newClient.lastName || '',
          phone: payload.newClient.phone,
        })
        .select('id')
        .single();

      if (clientError) {
        addToast({ type: 'error', message: 'Erreur lors de la creation du client' });
        throw clientError;
      }
      payload.clientId = newClientRow.id;
    }
    await addAppointmentGroup(payload);
    navigate('/calendar');
  };

  const sharedProps = {
    services,
    categories: serviceCategories,
    team,
    clients,
    appointments: allAppointments,
    onSave: handleSave,
    onCancel: () => navigate('/calendar'),
  };

  if (isMobile) {
    return <AppointmentBuilderMobile {...sharedProps} />;
  }

  return <AppointmentBuilder {...sharedProps} />;
};
```

- [ ] **Step 2: Update AppointmentEditPage**

Replace `modules/appointments/pages/AppointmentEditPage.tsx`:

```typescript
import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { supabase } from '../../../lib/supabase';
import { ServiceBlockState } from '../../../types';
import AppointmentBuilder from '../components/AppointmentBuilder';
import AppointmentBuilderMobile from '../components/AppointmentBuilderMobile';

export const AppointmentEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const { isMobile } = useMediaQuery();
  const { allAppointments, editAppointmentGroup, deleteAppointment } = useAppointments();
  const { allClients: clients } = useClients();
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  const selectedAppt = allAppointments.find(a => a.id === id);

  const excludeAppointmentIds = useMemo(() => {
    if (!selectedAppt) return [];
    if (selectedAppt.groupId) {
      return allAppointments.filter(a => a.groupId === selectedAppt.groupId).map(a => a.id);
    }
    return [selectedAppt.id];
  }, [selectedAppt, allAppointments]);

  const editInitialData = useMemo(() => {
    if (!selectedAppt) return undefined;

    const groupAppts = selectedAppt.groupId
      ? allAppointments.filter(a => a.groupId === selectedAppt.groupId)
      : [selectedAppt];

    const serviceBlocks: ServiceBlockState[] = groupAppts.map(appt => {
      const dateObj = new Date(appt.date);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      const svc = services.find(s => s.id === appt.serviceId);
      const variant = svc?.variants.find(v => v.price === appt.price && v.durationMinutes === appt.durationMinutes);

      return {
        id: crypto.randomUUID(),
        categoryId: svc?.categoryId ?? null,
        serviceId: appt.serviceId || null,
        variantId: variant?.id ?? null,
        staffId: appt.staffId || null,
        date: dateStr,
        hour: dateObj.getHours(),
        minute: dateObj.getMinutes(),
      };
    });

    return {
      clientId: selectedAppt.clientId,
      status: selectedAppt.status,
      notes: selectedAppt.notes ?? '',
      reminderMinutes: null as number | null,
      serviceBlocks,
    };
  }, [selectedAppt, allAppointments, services]);

  if (!selectedAppt) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Rendez-vous introuvable
      </div>
    );
  }

  const handleSave = async (payload: any) => {
    if (payload.newClient && activeSalon) {
      const { data: newClientRow, error: clientError } = await supabase
        .from('clients')
        .insert({
          salon_id: activeSalon.id,
          first_name: payload.newClient.firstName,
          last_name: payload.newClient.lastName || null,
          phone: payload.newClient.phone,
        })
        .select('id')
        .single();

      if (clientError) {
        addToast({ type: 'error', message: 'Erreur lors de la creation du client' });
        throw clientError;
      }
      payload.clientId = newClientRow.id;
    }
    await editAppointmentGroup({
      oldAppointmentId: id!,
      ...payload,
    });
    navigate('/calendar');
  };

  const handleDelete = async () => {
    try {
      await deleteAppointment(id!);
      navigate('/calendar');
    } catch {
      // Error toast handled by mutation's onError
    }
  };

  const sharedProps = {
    services,
    categories: serviceCategories,
    team,
    clients,
    appointments: allAppointments,
    excludeAppointmentIds,
    initialData: editInitialData,
    onSave: handleSave,
    onCancel: () => navigate(`/calendar/${id}`),
    onDelete: handleDelete,
  };

  if (isMobile) {
    return <AppointmentBuilderMobile {...sharedProps} />;
  }

  return <AppointmentBuilder {...sharedProps} />;
};
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Manual test on mobile viewport**

Open the dev server, use browser DevTools to toggle mobile viewport (375px width). Navigate to "Nouveau rendez-vous" and verify:
- Screen 1 renders with client search tap area, empty service block, status pills, notes, reminder
- Client bottom sheet opens on tap, search works, selecting a client closes sheet
- Service bottom sheet opens on tap, category pills scroll, selecting a variant closes sheet
- Staff pills appear below selected service
- "Continuer" button enables after selecting a service
- Screen 2 renders with calendar, time picker, "Confirmer" button
- Back arrow on screen 2 returns to screen 1 with state preserved
- Full flow: select client -> select service -> pick staff -> continue -> pick date -> pick time -> confirm

- [ ] **Step 5: Verify desktop unchanged**

Switch to desktop viewport. Confirm the appointment form looks and works exactly as before (two-column layout).

- [ ] **Step 6: Commit**

```bash
git add modules/appointments/pages/AppointmentNewPage.tsx modules/appointments/pages/AppointmentEditPage.tsx
git commit -m "feat: wire mobile/desktop appointment builder routing via isMobile"
```

---

### Task 7: Polish and Edge Cases

**Files:**
- Modify: `modules/appointments/components/AppointmentBuilderMobile.tsx` (if needed)

- [ ] **Step 1: Test edit mode on mobile**

Navigate to an existing appointment on mobile viewport. Verify:
- Title shows "Modifier le RDV"
- Delete button appears in header
- Service blocks pre-populated with correct data
- All fields editable
- Submit works

- [ ] **Step 2: Test multiple service blocks**

On mobile, add 2+ services. On screen 2, verify:
- Horizontal pill strip shows "Service 1", "Service 2"
- Tapping a pill switches the calendar/time picker to that block
- Green pill shows for blocks that already have date+time set
- "Confirmer" only enables when ALL blocks are scheduled

- [ ] **Step 3: Test new client flow**

On mobile, tap client area -> bottom sheet -> "Nouveau client" -> fill form -> "Ajouter". Verify the new client chip shows on screen 1. Submit the full appointment and verify it saves correctly.

- [ ] **Step 4: Final build check**

Run: `npm run build`
Expected: Clean build, no warnings.

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: mobile appointment form polish and edge case fixes"
```
