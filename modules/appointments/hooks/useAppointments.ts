import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { withMutationTimeout } from '../../../lib/mutations';
import {
  rawInsert,
  rawInsertReturning,
  rawRpc,
  rawSelect,
  rawUpdate,
} from '../../../lib/supabaseRaw';
import {
  type Appointment,
  AppointmentStatus,
  type DeletionReason,
} from '../../../types';
import { toAppointment, toAppointmentGroupInsert, toAppointmentInsert } from '../mappers';

export const useAppointments = (showDeleted = false) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { addToast } = useToast();
  const { toastOnError } = useMutationToast();

  const handleAppointmentEvent = useCallback(
    (payload: { eventType: string }) => {
      if (payload.eventType === 'INSERT') {
        addToast({ type: 'info', message: 'Nouveau rendez-vous ajouté' });
      }
    },
    [addToast],
  );

  useRealtimeSync('appointments', { onEvent: handleAppointmentEvent });
  useRealtimeSync('appointment_groups');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', salonId, { showDeleted }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append(
        'select',
        '*,clients(first_name,last_name),services(name),service_variants(name),staff_members!staff_id(first_name,last_name)',
      );
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', showDeleted ? 'not.is.null' : 'is.null');
      params.append('order', 'date.desc');
      const data = await rawSelect<Parameters<typeof toAppointment>[0]>(
        'appointments',
        params.toString(),
        signal,
      );
      return data.map(toAppointment);
    },
    enabled: !!salonId,
  });

  const addAppointmentMutation = useMutation({
    mutationFn: withMutationTimeout(async (appt: Appointment, signal: AbortSignal) => {
      try {
        await rawInsert('appointments', toAppointmentInsert(appt, salonId), signal);
      } catch (err) {
        if ((err as { code?: string }).code === '23P01') {
          throw new Error(
            'Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.',
          );
        }
        throw err;
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le rendez-vous"),
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: withMutationTimeout(async (appt: Appointment, signal: AbortSignal) => {
      const { id, salon_id, ...updateData } = toAppointmentInsert(appt, salonId);
      const params = new URLSearchParams();
      params.append('id', `eq.${appt.id}`);
      params.append('salon_id', `eq.${salonId}`);
      try {
        await rawUpdate('appointments', params.toString(), updateData, signal);
      } catch (err) {
        if ((err as { code?: string }).code === '23P01') {
          throw new Error(
            'Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.',
          );
        }
        throw err;
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError('Impossible de modifier le rendez-vous'),
  });

  const addAppointmentGroupMutation = useMutation({
    mutationFn: withMutationTimeout(
      async (
        payload: {
          clientId: string;
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
        },
        signal: AbortSignal,
      ) => {
        // 1. Insert the group
        const inserted = await rawInsertReturning<{ id: string }>(
          'appointment_groups',
          toAppointmentGroupInsert(payload, salonId),
          'id',
          signal,
        );
        const groupId = inserted[0]?.id;
        if (!groupId) throw new Error('Group insert returned no id');

        // 2. Insert each appointment linked to the group
        const appointmentRows = payload.serviceBlocks.map((block) => ({
          salon_id: salonId,
          group_id: groupId,
          client_id: payload.clientId || null,
          service_id: block.serviceId || null,
          service_variant_id: block.variantId || null,
          staff_id: block.staffId || null,
          date: block.date,
          duration_minutes: block.durationMinutes,
          price: block.price,
          status: payload.status,
          notes: payload.notes || null,
        }));

        await rawInsert('appointments', appointmentRows, signal);

        return groupId;
      },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous créé' });
    },
    onError: toastOnError('Erreur lors de la création du rendez-vous'),
  });

  type UpdateStatusVars = { appointmentId: string; status: string };
  type OptimisticContext = { snapshot: Array<[readonly unknown[], Appointment[] | undefined]> };
  const updateStatusMutation = useMutation<void, Error, UpdateStatusVars, OptimisticContext>({
    mutationFn: withMutationTimeout<UpdateStatusVars, void>(
      async ({ appointmentId, status }, signal) => {
        const params = new URLSearchParams();
        params.append('id', `eq.${appointmentId}`);
        params.append('salon_id', `eq.${salonId}`);
        await rawUpdate('appointments', params.toString(), { status }, signal);
      },
    ),
    onMutate: async ({ appointmentId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments', salonId] });
      const snapshot = queryClient.getQueriesData<Appointment[]>({
        queryKey: ['appointments', salonId],
      });
      queryClient.setQueriesData<Appointment[]>({ queryKey: ['appointments', salonId] }, (old) =>
        old?.map((a) =>
          a.id === appointmentId ? { ...a, status: status as Appointment['status'] } : a,
        ),
      );
      return { snapshot };
    },
    onError: (err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) queryClient.setQueryData(key, data);
      }
      toastOnError('Impossible de modifier le statut')(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
  });

  const editAppointmentGroupMutation = useMutation({
    mutationFn: withMutationTimeout(
      async (
        payload: {
          oldAppointmentId: string;
          clientId: string;
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
        },
        signal: AbortSignal,
      ) => {
        try {
          return await rawRpc<unknown>(
            'edit_appointment_group',
            {
              p_old_appointment_id: payload.oldAppointmentId,
              p_salon_id: salonId,
              p_client_id: payload.clientId || null,
              p_notes: payload.notes || null,
              p_reminder_minutes: payload.reminderMinutes ?? null,
              p_status: payload.status,
              p_service_blocks: payload.serviceBlocks.map((b) => ({
                service_id: b.serviceId || null,
                service_variant_id: b.variantId || null,
                staff_id: b.staffId || null,
                date: b.date,
                duration_minutes: b.durationMinutes,
                price: b.price,
              })),
            },
            signal,
          );
        } catch (err) {
          if ((err as { code?: string }).code === '23P01') {
            throw new Error(
              'Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.',
            );
          }
          throw err;
        }
      },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous modifié' });
    },
    onError: toastOnError('Erreur lors de la modification du rendez-vous'),
  });

  type CancelVars = {
    appointmentIds: string[];
    reason: DeletionReason;
    note?: string;
  };
  // Returns the count of rows actually cancelled (rows that were already
  // CANCELLED are silently skipped by the server RPC).
  const cancelAppointmentMutation = useMutation<number, Error, CancelVars, OptimisticContext>({
    mutationFn: withMutationTimeout<CancelVars, number>(
      async ({ appointmentIds, reason, note }, signal) => {
        // Atomic bulk RPC — all-or-nothing inside a single DB transaction.
        // Already-CANCELLED rows are skipped server-side (idempotent), so a
        // realtime race that cancels a sibling under us no longer errors.
        const trimmedNote = note?.trim() ? note.trim() : undefined;
        const data = await rawRpc<number | null>(
          'delete_appointments_bulk',
          {
            p_appointment_ids: appointmentIds,
            p_reason: reason,
            p_note: trimmedNote,
          },
          signal,
        );
        return data ?? 0;
      },
    ),
    onMutate: async ({ appointmentIds, reason, note }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments', salonId] });
      const snapshot = queryClient.getQueriesData<Appointment[]>({
        queryKey: ['appointments', salonId],
      });
      const nowIso = new Date().toISOString();
      const idSet = new Set(appointmentIds);
      const trimmedNote = note?.trim() || null;
      queryClient.setQueriesData<Appointment[]>({ queryKey: ['appointments', salonId] }, (old) =>
        old?.map((a) =>
          idSet.has(a.id) && a.status !== AppointmentStatus.CANCELLED
            ? {
                ...a,
                status: AppointmentStatus.CANCELLED,
                deletionReason: reason,
                deletionNote: trimmedNote,
                cancelledAt: nowIso,
              }
            : a,
        ),
      );
      return { snapshot };
    },
    onSuccess: (cancelledCount) => {
      if (cancelledCount === 0) {
        // No-op case: every target was already CANCELLED (realtime race or
        // duplicate click). Server succeeded, nothing to celebrate.
        addToast({ type: 'info', message: 'Rendez-vous déjà annulé' });
      } else if (cancelledCount === 1) {
        addToast({ type: 'success', message: 'Rendez-vous annulé' });
      } else {
        addToast({
          type: 'success',
          message: `Visite annulée (${cancelledCount} services)`,
        });
      }
    },
    onError: (err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) queryClient.setQueryData(key, data);
      }
      toastOnError("Erreur lors de l'annulation du rendez-vous")(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
  });

  const deleteAppointmentMutation = useMutation<void, Error, string, OptimisticContext>({
    mutationFn: withMutationTimeout<string, void>(async (appointmentId, signal) => {
      await rawRpc('soft_delete_appointment', { p_appointment_id: appointmentId }, signal);
    }),
    onMutate: async (appointmentId) => {
      await queryClient.cancelQueries({ queryKey: ['appointments', salonId] });
      const snapshot = queryClient.getQueriesData<Appointment[]>({
        queryKey: ['appointments', salonId],
      });
      queryClient.setQueriesData<Appointment[]>({ queryKey: ['appointments', salonId] }, (old) =>
        old?.filter((a) => a.id !== appointmentId),
      );
      return { snapshot };
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Rendez-vous supprimé' });
    },
    onError: (err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) queryClient.setQueryData(key, data);
      }
      toastOnError('Erreur lors de la suppression du rendez-vous')(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
  });

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const matchesSearch =
        a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, searchTerm, statusFilter]);

  return {
    appointments: filteredAppointments,
    allAppointments: appointments,
    isLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    addAppointment: (appt: Appointment) => addAppointmentMutation.mutate(appt),
    updateAppointment: (appt: Appointment) => updateAppointmentMutation.mutate(appt),
    addAppointmentGroup: addAppointmentGroupMutation.mutateAsync,
    isAddingGroup: addAppointmentGroupMutation.isPending,
    editAppointmentGroup: editAppointmentGroupMutation.mutateAsync,
    isEditingGroup: editAppointmentGroupMutation.isPending,
    updateStatus: (appointmentId: string, status: string) =>
      updateStatusMutation.mutateAsync({ appointmentId, status }),
    deleteAppointment: deleteAppointmentMutation.mutateAsync,
    isDeleting: deleteAppointmentMutation.isPending,
    cancelAppointments: (
      appointmentIds: string[],
      reason: DeletionReason,
      note?: string,
    ) => cancelAppointmentMutation.mutateAsync({ appointmentIds, reason, note }),
    isCancelling: cancelAppointmentMutation.isPending,
  };
};
