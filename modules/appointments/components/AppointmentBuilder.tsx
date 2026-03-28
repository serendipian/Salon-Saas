import React, { useState, useCallback, useMemo } from 'react';
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
import ClientField from './ClientField';
import ServiceBlock from './ServiceBlock';
import SchedulingPanel from './SchedulingPanel';
import AppointmentSummary from './AppointmentSummary';
import { useStaffAvailability } from '../hooks/useStaffAvailability';
import { formatPrice } from '../../../lib/format';

interface AppointmentBuilderProps {
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
  onCancel: () => void;
  onDelete?: () => void;
  // For edit mode
  initialData?: {
    clientId: string;
    status: AppointmentStatus;
    notes: string;
    reminderMinutes: number | null;
    serviceBlocks: ServiceBlockState[];
  };
}

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

export default function AppointmentBuilder({
  services,
  categories,
  team,
  clients,
  appointments,
  onSave,
  onCancel,
  onDelete,
  initialData,
}: AppointmentBuilderProps) {
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

  // Staff availability for active block
  const unavailableHours = useStaffAvailability(
    activeStaff,
    activeBlock?.date ?? null,
    effectiveDuration,
    appointments,
  );

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
    // Copy date from last block if set
    const lastBlock = serviceBlocks[serviceBlocks.length - 1];
    if (lastBlock?.date) {
      newBlock.date = lastBlock.date;
    }
    setServiceBlocks((prev) => [...prev, newBlock]);
    setActiveBlockIndex(serviceBlocks.length);
  }, [serviceBlocks]);

  // Build summary text for collapsed blocks
  const getBlockSummary = (block: ServiceBlockState): string => {
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
      staff ? `· ${staff.firstName} ${staff.lastName[0]}.` : null,
    ].filter(Boolean);
    return parts.join(' ');
  };

  // Submit
  const handleSubmit = async () => {
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
        const isoDate = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

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
  };

  return (
    <div className="flex gap-4 max-md:flex-col">
      {/* LEFT PANEL */}
      <div className="flex-[1.3] bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-semibold text-slate-800">
            {initialData ? 'Modifier le rendez-vous' : 'Nouveau Rendez-vous'}
          </h3>
          <div className="flex gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="bg-white border border-red-300 text-red-600 px-3.5 py-1.5 rounded-md text-xs hover:bg-red-50"
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="bg-white border border-slate-200 text-slate-500 px-3.5 py-1.5 rounded-md text-xs"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-pink-400 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        {/* Client */}
        <ClientField
          clients={clients}
          selectedClientId={clientId}
          onSelectClient={(id) => { setClientId(id); setNewClient(null); clearFieldError('clientId'); }}
          onClearClient={() => setClientId(null)}
          newClientData={newClient}
          onNewClientChange={setNewClient}
          error={errors.clientId}
        />

        <div className="border-t border-slate-200 mb-4" />

        {/* Service blocks */}
        <div className="space-y-3 mb-3">
          {serviceBlocks.map((block, i) => (
            <ServiceBlock
              key={block.id}
              block={block}
              index={i}
              isActive={i === activeBlockIndex}
              services={services}
              categories={categories}
              team={team}
              onActivate={() => setActiveBlockIndex(i)}
              onRemove={() => removeBlock(i)}
              onChange={(updates) => updateBlock(i, updates)}
              summaryText={getBlockSummary(block)}
            />
          ))}
        </div>

        {/* Add service button */}
        <button
          type="button"
          onClick={addBlock}
          className="w-full border border-dashed border-slate-300 rounded-xl py-3 text-slate-500 text-xs hover:border-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1.5 mb-4"
        >
          <span className="text-pink-600 font-bold text-base">+</span> Ajouter un service
        </button>

        {/* Notes */}
        <div>
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">
            Notes
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajouter des notes..."
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:border-pink-400 focus:outline-none resize-none min-h-[44px]"
          />
        </div>

        {/* Total Summary */}
        {serviceBlocks.length > 0 && (
          <div className="mt-4">
            <AppointmentSummary
              serviceBlocks={serviceBlocks}
              services={services}
            />
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-[0.6]">
        <SchedulingPanel
          activeDate={activeBlock?.date ?? null}
          activeHour={activeBlock?.hour ?? null}
          activeMinute={activeBlock?.minute ?? 0}
          onDateChange={(date) => updateBlock(activeBlockIndex, { date })}
          onHourChange={(hour) => updateBlock(activeBlockIndex, { hour })}
          onMinuteChange={(minute) => updateBlock(activeBlockIndex, { minute })}
          status={status}
          onStatusChange={setStatus}
          reminderMinutes={reminderMinutes}
          onReminderChange={setReminderMinutes}
          unavailableHours={unavailableHours}
        />
      </div>
    </div>
  );
}
