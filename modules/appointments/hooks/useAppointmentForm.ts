import { useState, useCallback, useMemo } from 'react';
import type {
  Appointment,
  AppointmentStatus,
  ServiceBlockState,
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
import { formatPrice } from '../../../lib/format';

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
  activeVariant: { id: string; name: string; price: number; durationMinutes: number } | null;
  activeService: Service | null;
  effectiveDuration: number;
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
    serviceId: null,
    variantId: null,
    staffId: null,
    date: null,
    hour: null,
    minute: 0,
  };
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
    effectiveDuration,
    availabilityAppointments,
  );

  // Totals & completeness
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
      return sum + (b.priceOverride ?? variant?.price ?? svc?.price ?? 0);
    }, 0);
  }, [serviceBlocks, services]);

  const hasCompleteServiceBlock = serviceBlocks.some(b => b.serviceId && b.variantId);

  const allBlocksScheduled = serviceBlocks.every(b => b.serviceId && b.variantId && b.date && b.hour !== null);

  // Handlers
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
    const newBlock = createEmptyBlock();
    setServiceBlocks((prev) => {
      const lastBlock = prev[prev.length - 1];
      if (lastBlock?.date) {
        newBlock.date = lastBlock.date;
      }
      setActiveBlockIndex(prev.length);
      return [...prev, newBlock];
    });
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

    setServiceBlocks((prev) => {
      const base = prev.length === 1 && !prev[0].serviceId ? [] : prev;
      const lastBlock = base[base.length - 1];
      const lastDate = lastBlock?.date ?? null;

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
      }));

      setActiveBlockIndex(base.length);
      return [...base, ...newBlocks];
    });
  }, []);

  // Build summary text for collapsed blocks
  const getBlockSummary = useCallback(
    (block: ServiceBlockState): string => {
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
    },
    [services, team],
  );

  // Submit
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

    // Validate new client separately if present
    if (newClient) {
      const clientResult = newClientSchema.safeParse(newClient);
      if (!clientResult.success) {
        return;
      }
    }

    // Build save payload
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
        // Build a local Date and convert to ISO (UTC) so timezone is preserved
        const [year, month, day] = dateStr.split('-').map(Number);
        const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
        const isoDate = localDate.toISOString();

        return {
          serviceId: b.serviceId ?? '',
          variantId: b.variantId ?? '',
          staffId: b.staffId,
          date: isoDate,
          durationMinutes: variant?.durationMinutes ?? svc?.durationMinutes ?? 30,
          price: b.priceOverride ?? variant?.price ?? svc?.price ?? 0,
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
    activeVariant,
    activeService,
    effectiveDuration,
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
