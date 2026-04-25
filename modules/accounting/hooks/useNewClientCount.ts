// modules/accounting/hooks/useNewClientCount.ts
import { useQuery } from '@tanstack/react-query';
import { rawRpc } from '../../../lib/supabaseRaw';

export const useNewClientCount = (salonId: string, from: string, to: string) => {
  return useQuery({
    queryKey: ['new_client_count', salonId, from, to],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<{ new_clients: number | string }[] | { new_clients: number | string } | null>(
        'count_new_clients',
        { p_salon_id: salonId, p_from: from, p_to: to },
        signal,
      );
      // RPC returns TABLE(new_clients bigint) — PostgREST wraps as array
      const row = Array.isArray(data) ? data[0] : data;
      return Number(row?.new_clients ?? 0);
    },
    enabled: !!salonId && !!from && !!to,
  });
};
