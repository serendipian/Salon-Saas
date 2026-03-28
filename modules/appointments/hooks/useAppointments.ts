import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toAppointment, toAppointmentInsert, toAppointmentGroupInsert } from '../mappers';
import type { Appointment } from '../../../types';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useToast } from '../../../context/ToastContext';
import { useMutationToast } from '../../../hooks/useMutationToast';

export const useAppointments = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { addToast } = useToast();
  const { toastOnError } = useMutationToast();

  const handleAppointmentEvent = useCallback((payload: { eventType: string }) => {
    if (payload.eventType === 'INSERT') {
      addToast({ type: 'info', message: 'Nouveau rendez-vous ajouté' });
    }
  }, [addToast]);

  useRealtimeSync('appointments', { onEvent: handleAppointmentEvent });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(first_name, last_name), services(name), staff_members(first_name, last_name)')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toAppointment);
    },
    enabled: !!salonId,
  });

  const addAppointmentMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const { error } = await supabase
        .from('appointments')
        .insert(toAppointmentInsert(appt, salonId));
      if (error) {
        // Surface double-booking constraint violation
        if (error.code === '23P01') {
          throw new Error('Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le rendez-vous"),
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const { id, salon_id, ...updateData } = toAppointmentInsert(appt, salonId);
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appt.id);
      if (error) {
        if (error.code === '23P01') {
          throw new Error('Ce créneau est déjà occupé pour ce praticien. Veuillez choisir un autre horaire.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
    },
    onError: toastOnError("Impossible de modifier le rendez-vous"),
  });

  const addAppointmentGroupMutation = useMutation({
    mutationFn: async (payload: {
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
    }) => {
      // 1. Insert the group
      const { data: group, error: groupError } = await supabase
        .from('appointment_groups')
        .insert(toAppointmentGroupInsert(payload, salonId))
        .select('id')
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
        .insert(appointmentRows);

      if (apptError) throw apptError;

      return group.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      addToast({ type: 'success', message: 'Rendez-vous créé' });
    },
    onError: toastOnError('Erreur lors de la création du rendez-vous'),
  });

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const matchesSearch = a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
  };
};
