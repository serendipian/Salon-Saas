// modules/clients/hooks/useClientAppointments.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { rawSelect } from '../../../lib/supabaseRaw';
import { toAppointment } from '../../appointments/mappers';

export const useClientAppointments = (clientId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Needed: ClientDetails is the only appointment-aware component on this page.
  // Ref-counted manager deduplicates if useAppointments is mounted elsewhere.
  useRealtimeSync('appointments');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', salonId, 'client', clientId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append(
        'select',
        '*,clients(first_name,last_name),services(name),service_variants(name),staff_members!staff_id(first_name,last_name)',
      );
      params.append('salon_id', `eq.${salonId}`);
      params.append('client_id', `eq.${clientId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'date.desc');
      const data = await rawSelect<Parameters<typeof toAppointment>[0]>(
        'appointments',
        params.toString(),
        signal,
      );
      return data.map(toAppointment);
    },
    enabled: !!salonId && !!clientId,
  });

  return { appointments, isLoading };
};
