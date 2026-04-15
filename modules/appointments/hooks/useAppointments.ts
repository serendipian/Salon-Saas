import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { withMutationTimeout } from '../../../lib/mutations';
import { supabase } from '../../../lib/supabase';
import type { Appointment } from '../../../types';
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
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(
          '*, clients(first_name, last_name), services(name), service_variants(name), staff_members(first_name, last_name)',
        )
        .eq('salon_id', salonId);
      if (showDeleted) {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.is('deleted_at', null);
      }
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toAppointment);
    },
    enabled: !!salonId,
  });

  const addAppointmentMutation = useMutation({
    mutationFn: withMutationTimeout(async (appt: Appointment, signal: AbortSignal) => {
      const { error } = await supabase
        .from('appointments')
        .insert(toAppointmentInsert(appt, salonId))
        .abortSignal(signal);
      if (error) {
        if (error.code === '23P01') {
          throw new Error(
            'Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.',
          );
        }
        throw error;
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
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appt.id)
        .eq('salon_id', salonId)
        .abortSignal(signal);
      if (error) {
        if (error.code === '23P01') {
          throw new Error(
            'Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.',
          );
        }
        throw error;
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
        const { data: group, error: groupError } = await supabase
          .from('appointment_groups')
          .insert(toAppointmentGroupInsert(payload, salonId))
          .select('id')
          .abortSignal(signal)
          .single();

        if (groupError) throw groupError;

        // 2. Insert each appointment linked to the group
        const appointmentRows = payload.serviceBlocks.map((block) => ({
          salon_id: salonId,
          group_id: group.id,
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

        const { error: apptError } = await supabase
          .from('appointments')
          .insert(appointmentRows)
          .abortSignal(signal);

        if (apptError) throw apptError;

        return group.id;
      },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous créé' });
    },
    onError: toastOnError('Erreur lors de la création du rendez-vous'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: withMutationTimeout(
      async (
        { appointmentId, status }: { appointmentId: string; status: string },
        signal: AbortSignal,
      ) => {
        const { error } = await supabase
          .from('appointments')
          .update({ status })
          .eq('id', appointmentId)
          .eq('salon_id', salonId)
          .abortSignal(signal);
        if (error) throw error;
      },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError('Impossible de modifier le statut'),
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
        const { data, error } = await supabase
          .rpc('edit_appointment_group', {
            p_old_appointment_id: payload.oldAppointmentId,
            p_salon_id: salonId,
            p_client_id: payload.clientId || null,
            p_notes: payload.notes || null,
            p_reminder_minutes: payload.reminderMinutes,
            p_status: payload.status,
            p_service_blocks: payload.serviceBlocks.map((b) => ({
              service_id: b.serviceId || null,
              service_variant_id: b.variantId || null,
              staff_id: b.staffId || null,
              date: b.date,
              duration_minutes: b.durationMinutes,
              price: b.price,
            })),
          })
          .abortSignal(signal);
        if (error) {
          if (error.code === '23P01') {
            throw new Error(
              'Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.',
            );
          }
          throw error;
        }
        return data;
      },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous modifié' });
    },
    onError: toastOnError('Erreur lors de la modification du rendez-vous'),
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: withMutationTimeout(async (appointmentId: string, signal: AbortSignal) => {
      const { error } = await supabase
        .rpc('soft_delete_appointment', {
          p_appointment_id: appointmentId,
        })
        .abortSignal(signal);
      if (error) throw error;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous supprimé' });
    },
    onError: toastOnError('Erreur lors de la suppression du rendez-vous'),
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
  };
};
