import { useState, useCallback, useMemo } from 'react';
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
import { appointmentGroupSchema, newClientSchema } from '../schemas';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { useStaffAvailability } from './useStaffAvailability';
import { formatPrice, formatDuration } from '../../../lib/format';

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

export function useAppointmentForm(props: UseAppointmentFormProps): AppointmentFormReturn {
  const { services, team, appointments, onSave, excludeAppointmentIds, initialData } = props;

  const [isSaving, setIsSaving] = useState(false);

  // Client state
  const [clientId, setClientId] = useState<string | null>(initialData?.clientId ?? null);
  const [newClient, setNewClient] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);

  // Service blocks
  const [serviceBlocks, setServiceBlocks] = useState<ServiceBlockState[]>(
    initialData?.serviceBlocks ?? [createEmptyBlock()],
  );
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

  // Handlers
  const updateBlock = useCallback((index: number, updates: Partial<ServiceBlockState>) => {
    setServiceBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...updates } : b)),
    );
  }, []);

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
            // Same service, different variant → replace variant (category unchanged by definition)
            const nextItems = b.items.slice();
            nextItems[existingIdx] = { ...existing, variantId };
            return { ...b, items: nextItems };
          }
          // New service → enforce category consistency (defense in depth).
          // All items in a block must share a single category because the block
          // is performed by one staff member, and staff competence is category-scoped.
          if (b.items.length > 0) {
            const lockedSvc = services.find((s) => s.id === b.items[0].serviceId);
            const candidateSvc = services.find((s) => s.id === serviceId);
            if (lockedSvc?.categoryId && candidateSvc?.categoryId && lockedSvc.categoryId !== candidateSvc.categoryId) {
              return b; // reject: cross-category insert
            }
          }
          return { ...b, items: [...b.items, { serviceId, variantId }] };
        }),
      );
    },
    [services],
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

  const addPackBlocks = useCallback((pack: Pack) => {
    const totalOriginal = pack.items.reduce((sum, item) => sum + item.originalPrice, 0);
    if (totalOriginal === 0 || pack.items.length === 0) return;

    // Compute pro-rata prices with rounding fix
    const proRataPrices = pack.items.map((item) =>
      Math.round((item.originalPrice / totalOriginal) * pack.price * 100) / 100
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

    let firstNewBlockIndex = 0;

    setServiceBlocks((prev) => {
      // Toggle: if the same pack is already selected, remove all its blocks.
      // If that would leave the form empty, replace with a fresh empty placeholder.
      const hasPack = prev.some((b) => b.packId === pack.id);
      if (hasPack) {
        const remaining = prev.filter((b) => b.packId !== pack.id);
        if (remaining.length === 0) {
          firstNewBlockIndex = 0;
          return [createEmptyBlock()];
        }
        firstNewBlockIndex = remaining.length - 1;
        return remaining;
      }

      // Strip any blocks from a previously selected pack (switching packs),
      // and drop a lone empty placeholder block if that's all there is.
      const base = prev.length === 1 && prev[0].items.length === 0
        ? []
        : prev.filter((b) => !b.packId);

      const lastBlock = base[base.length - 1];
      const lastDate = lastBlock?.date ?? null;

      firstNewBlockIndex = base.length;

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

      return [...base, ...newBlocks];
    });
    // Separate setState call — don't nest setState inside another updater
    setActiveBlockIndex(firstNewBlockIndex);
  }, []);

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

  // Submit — expand each block's items[] into sequential appointment rows
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
}
