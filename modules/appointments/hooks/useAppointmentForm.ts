import { useCallback, useMemo, useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { formatDuration, formatPrice } from '../../../lib/format';
import type {
  Appointment,
  AppointmentStatus,
  Client,
  FavoriteItem,
  Pack,
  Service,
  ServiceBlockState,
  ServiceCategory,
  StaffMember,
} from '../../../types';
import { appointmentGroupSchema, newClientSchema } from '../schemas';
import { type BlockConflict, deriveBlockConflicts } from '../utils/deriveBlockConflicts';
import { type MissingField, buildMissingFields } from '../utils/missingFields';
import { useStaffAvailability } from './useStaffAvailability';

export interface UseAppointmentFormProps {
  services: Service[];
  categories: ServiceCategory[];
  favorites?: FavoriteItem[];
  packs?: Pack[];
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
    clientId?: string;
    status?: AppointmentStatus;
    notes?: string;
    reminderMinutes?: number | null;
    serviceBlocks?: ServiceBlockState[];
  };
}

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
  blockConflicts: Map<number, BlockConflict>;
  hasAnyConflict: boolean;
  missingFields: MissingField[];
  canSubmit: boolean;
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
  addPackBlocks: (pack: Pack, blockIndex: number) => void;
  clearFieldError: (field: string) => void;

  // Helpers
  getBlockSummary: (block: ServiceBlockState) => string;
  handleSubmit: () => Promise<void>;
  isStaffAvailableForSlot: (
    staffId: string,
    date: string,
    hour: number,
    minute: number,
    blockIndex: number,
  ) => boolean;

  // Props passthrough for components
  initialData: UseAppointmentFormProps['initialData'];
}

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

/**
 * M-18: Returns true if any item in the block references a service or variant
 * that no longer exists. Used at save time to abort with a clear error rather
 * than silently writing a 0-price appointment from a deleted reference.
 *
 * `priceOverride` does NOT make an item valid — the variant must still exist
 * because the appointment row needs `variant_id` to point at a real row.
 */
export function blockHasMissingItems(block: ServiceBlockState, services: Service[]): boolean {
  return block.items.some((item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    if (!svc) return true;
    const variant = svc.variants.find((v) => v.id === item.variantId);
    return !variant;
  });
}

export function useAppointmentForm(props: UseAppointmentFormProps): AppointmentFormReturn {
  const { services, team, appointments, onSave, excludeAppointmentIds, initialData } = props;
  const { addToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);

  // Client state
  const [clientId, setClientId] = useState<string | null>(initialData?.clientId ?? null);
  const [newClient, setNewClient] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);

  // Service blocks — mark existing blocks with items as staff-confirmed for edit mode
  const [serviceBlocks, setServiceBlocks] = useState<ServiceBlockState[]>(() => {
    const blocks = initialData?.serviceBlocks ?? [createEmptyBlock()];
    return blocks.map((b) => (b.items.length > 0 ? { ...b, staffConfirmed: true } : b));
  });
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);

  // Scheduling
  const [status, setStatus] = useState<AppointmentStatus>(
    initialData?.status ?? ('SCHEDULED' as AppointmentStatus),
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    initialData?.reminderMinutes ?? null,
  );

  // Validation
  const { errors, validate, clearFieldError } = useFormValidation(appointmentGroupSchema);

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

  // Filter out appointments being edited from availability check
  const availabilityAppointments = useMemo(() => {
    if (!excludeAppointmentIds || excludeAppointmentIds.length === 0) return appointments;
    const excludeSet = new Set(excludeAppointmentIds);
    return appointments.filter((a) => !excludeSet.has(a.id));
  }, [appointments, excludeAppointmentIds]);

  // Staff availability for active block
  const unavailableHours = useStaffAvailability(
    activeStaff,
    activeBlock?.date ?? null,
    activeBlockDuration || 30,
    availabilityAppointments,
  );

  // Per-block conflict derivation (covers DB conflicts, off-day, sibling overlap).
  const blockConflicts = useMemo(
    () =>
      deriveBlockConflicts({
        blocks: serviceBlocks,
        team,
        services,
        existingAppointments: availabilityAppointments,
        excludeAppointmentIds,
      }),
    [serviceBlocks, team, services, availabilityAppointments, excludeAppointmentIds],
  );

  const hasAnyConflict = blockConflicts.size > 0;

  const missingFields = useMemo<MissingField[]>(
    () => buildMissingFields({ clientId, newClient, blocks: serviceBlocks }),
    [clientId, newClient, serviceBlocks],
  );

  /**
   * Probe: would this staff be available if we placed them at the given
   * (date, hour, minute) for the block at blockIndex's duration?
   * Used by StaffPills to dim unavailable members for the active slot.
   */
  const isStaffAvailableForSlot = useCallback(
    (staffId: string, date: string, hour: number, minute: number, blockIndex: number): boolean => {
      const block = serviceBlocks[blockIndex];
      if (!block) return true;
      const probe: ServiceBlockState = { ...block, staffId, date, hour, minute };
      const probeBlocks = serviceBlocks.map((b, i) => (i === blockIndex ? probe : b));
      const result = deriveBlockConflicts({
        blocks: probeBlocks,
        team,
        services,
        existingAppointments: availabilityAppointments,
        excludeAppointmentIds,
      });
      return !result.has(blockIndex);
    },
    [serviceBlocks, team, services, availabilityAppointments, excludeAppointmentIds],
  );

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

  // Save is only allowed when nothing is missing AND there are no conflicts.
  // Kept separate from `allBlocksScheduled` so existing callers (mobile screen 1
  // gate) keep their narrower meaning.
  const canSubmit = missingFields.length === 0 && !hasAnyConflict;

  // Handlers
  const updateBlock = useCallback((index: number, updates: Partial<ServiceBlockState>) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        // M-25: Date/time intentionally NOT wiped on staff change. The new
        // blockConflicts derivation surfaces stale-time mismatches as a
        // visible amber banner instead of silently erasing user input.
        return { ...b, ...updates };
      }),
    );
  }, []);

  const toggleBlockItem = useCallback(
    (index: number, serviceId: string, variantId: string) => {
      // Pre-compute cross-category rejection outside the updater so the
      // reducer stays pure and the toast can fire from a normal code path.
      // M-17: previously the reject path was silent and confusing.
      const currentBlock = serviceBlocks[index];
      if (
        currentBlock &&
        currentBlock.items.length > 0 &&
        !currentBlock.items.some((item) => item.serviceId === serviceId)
      ) {
        const lockedSvc = services.find((s) => s.id === currentBlock.items[0].serviceId);
        const candidateSvc = services.find((s) => s.id === serviceId);
        if (
          lockedSvc?.categoryId &&
          candidateSvc?.categoryId &&
          lockedSvc.categoryId !== candidateSvc.categoryId
        ) {
          addToast({
            type: 'warning',
            message: 'Impossible de mélanger les catégories dans un même créneau.',
          });
          return;
        }
      }

      // Reset downstream selections when services change
      const resetDownstream = {
        staffId: null,
        staffConfirmed: false,
        date: null,
        hour: null,
        minute: 0,
      };

      setServiceBlocks((prev) =>
        prev.map((b, i) => {
          if (i !== index) return b;
          const existingIdx = b.items.findIndex((item) => item.serviceId === serviceId);
          if (existingIdx >= 0) {
            const existing = b.items[existingIdx];
            if (existing.variantId === variantId) {
              // Same service + same variant → remove
              return {
                ...b,
                ...resetDownstream,
                items: b.items.filter((_, idx) => idx !== existingIdx),
              };
            }
            // Same service, different variant → replace variant (category unchanged by definition)
            const nextItems = b.items.slice();
            nextItems[existingIdx] = { ...existing, variantId };
            return { ...b, ...resetDownstream, items: nextItems };
          }
          // New service → defensive same-category check (should be unreachable
          // now that the pre-check above rejects with a toast; kept as a
          // belt-and-braces guard against stale closures or race conditions).
          if (b.items.length > 0) {
            const lockedSvc = services.find((s) => s.id === b.items[0].serviceId);
            const candidateSvc = services.find((s) => s.id === serviceId);
            if (
              lockedSvc?.categoryId &&
              candidateSvc?.categoryId &&
              lockedSvc.categoryId !== candidateSvc.categoryId
            ) {
              return b;
            }
          }
          return { ...b, ...resetDownstream, items: [...b.items, { serviceId, variantId }] };
        }),
      );
    },
    [serviceBlocks, services, addToast],
  );

  const clearBlockItems = useCallback((index: number) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        return {
          ...b,
          items: [],
          staffId: null,
          staffConfirmed: false,
          date: null,
          hour: null,
          minute: 0,
          packId: null,
        };
      }),
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
    const newBlock = createEmptyBlock();
    let newLength = 0;
    setServiceBlocks((prev) => {
      const lastBlock = prev[prev.length - 1];
      if (lastBlock?.date) {
        newBlock.date = lastBlock.date;
      }
      newLength = prev.length + 1;
      return [...prev, newBlock];
    });
    // Use functional updater to derive from current — no nesting inside setServiceBlocks
    setActiveBlockIndex(() => newLength - 1);
  }, []);

  const addPackBlocks = useCallback(
    (pack: Pack, blockIndex: number) => {
      const totalOriginal = pack.items.reduce((sum, item) => sum + item.originalPrice, 0);
      if (totalOriginal === 0 || pack.items.length === 0) return;

      // Reject if this pack is already selected in a different block — packs
      // cannot be duplicated across the appointment group.
      const existingIdx = serviceBlocks.findIndex((b) => b.packId === pack.id);
      if (existingIdx >= 0 && existingIdx !== blockIndex) {
        addToast({ type: 'warning', message: 'Ce pack est déjà sélectionné.' });
        return;
      }

      // Compute pro-rata prices with rounding fix
      const proRataPrices = pack.items.map(
        (item) => Math.round((item.originalPrice / totalOriginal) * pack.price * 100) / 100,
      );
      const roundedSum = proRataPrices.reduce((s, p) => s + p, 0);
      const diff = Math.round((pack.price - roundedSum) * 100) / 100;
      if (diff !== 0) {
        let maxIdx = 0;
        for (let i = 1; i < pack.items.length; i++) {
          if (pack.items[i].originalPrice > pack.items[maxIdx].originalPrice) maxIdx = i;
        }
        proRataPrices[maxIdx] = Math.round((proRataPrices[maxIdx] + diff) * 100) / 100;
      }

      setServiceBlocks((prev) => {
        if (blockIndex < 0 || blockIndex >= prev.length) return prev;
        return prev.map((b, i) => {
          if (i !== blockIndex) return b;
          // Toggle off when the same pack is tapped again in this block.
          // Preserve the date so the user doesn't lose the day they picked.
          if (b.packId === pack.id) {
            return {
              ...b,
              categoryId: null,
              items: [],
              staffId: null,
              staffConfirmed: false,
              hour: null,
              minute: 0,
              packId: null,
            };
          }
          // Write pack into this block in place (replaces a different pack or
          // any prior items). Date is preserved for the same reason.
          const packItems = pack.items.map((item, idx) => ({
            serviceId: item.serviceId,
            variantId: item.serviceVariantId,
            priceOverride: proRataPrices[idx],
          }));
          return {
            ...b,
            categoryId: null,
            items: packItems,
            staffId: null,
            staffConfirmed: false,
            hour: null,
            minute: 0,
            packId: pack.id,
          };
        });
      });
      setActiveBlockIndex(blockIndex);
    },
    [serviceBlocks, addToast],
  );

  // Build summary text for collapsed blocks
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
        return 'Prestation';
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

  // Submit — expand each block's items[] into sequential appointment rows
  const handleSubmit = useCallback(async () => {
    const effectiveClientId = newClient ? 'pending-new-client' : (clientId ?? '');

    // Realtime safety: if remote data made the form conflict-prone since the
    // user last looked, refuse to submit and let the visible banners do the
    // talking.
    if (hasAnyConflict) {
      addToast({
        type: 'warning',
        message: 'Conflit de planning. Modifiez le membre ou le créneau pour continuer.',
      });
      return;
    }

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

    // M-18: Reject save if any item references a deleted service/variant.
    // The flatten loop below would otherwise write a row with `price: 0`
    // and a stale `variant_id`, surfacing as a confusing FK error from
    // Supabase or a silent zero-price appointment.
    const hasMissing = serviceBlocks.some((b) => blockHasMissingItems(b, services));
    if (hasMissing) {
      addToast({
        type: 'error',
        message:
          'Une prestation référence un service ou une variante supprimé. Retirez-la avant de sauvegarder.',
      });
      return;
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
  }, [
    newClient,
    clientId,
    serviceBlocks,
    status,
    notes,
    reminderMinutes,
    validate,
    services,
    onSave,
    addToast,
    hasAnyConflict,
  ]);

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
    blockConflicts,
    hasAnyConflict,
    missingFields,
    canSubmit,
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
    isStaffAvailableForSlot,

    // Props passthrough
    initialData,
  };
}
