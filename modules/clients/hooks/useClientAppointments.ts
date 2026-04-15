// modules/clients/hooks/useClientAppointments.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toAppointment } from '../../appointments/mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';

export const useClientAppointments = (clientId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Needed: ClientDetails is the only appointment-aware component on this page.
  // Ref-counted manager deduplicates if useAppointments is mounted elsewhere.
  useRealtimeSync('appointments');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', salonId, 'client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(
          '*, clients(first_name, last_name), services(name), service_variants(name), staff_members(first_name, last_name)',
        )
        .eq('salon_id', salonId)
        .eq('client_id', clientId)
        .is('deleted_at', null)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toAppointment);
    },
    enabled: !!salonId && !!clientId,
  });

  return { appointments, isLoading };
};
