// modules/accounting/hooks/useNewClientCount.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export const useNewClientCount = (salonId: string, from: string, to: string) => {
  return useQuery({
    queryKey: ['new_client_count', salonId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_new_clients', {
        p_salon_id: salonId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      // RPC returns TABLE(new_clients bigint) — Supabase wraps as array
      const row = Array.isArray(data) ? data[0] : data;
      return Number(row?.new_clients ?? 0);
    },
    enabled: !!salonId && !!from && !!to,
  });
};
