import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { rawRpc } from '../../../lib/supabaseRaw';
import type { StaffClient } from '../../../types';

export const useStaffClients = (staffId: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['staff_clients', salonId, staffId],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<any[] | null>(
        'get_staff_clients',
        { p_staff_id: staffId, p_limit: 10 },
        signal,
      );
      return (data || []).map(
        (row: any): StaffClient => ({
          clientId: row.client_id,
          clientFirstName: row.client_first_name,
          clientLastName: row.client_last_name,
          visitCount: row.visit_count,
          totalRevenue: parseFloat(row.total_revenue),
          lastVisit: row.last_visit,
        }),
      );
    },
    enabled: !!salonId && !!staffId,
  });

  return { clients, isLoading };
};
