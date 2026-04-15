import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { supabase } from '../../../lib/supabase';
import type { Client } from '../../../types';
import { toClient, toClientInsert } from '../mappers';

export const useClients = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();
  useRealtimeSync('clients');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', salonId],
    queryFn: async () => {
      // Fetch clients and stats separately, then merge
      const [clientsRes, statsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .eq('salon_id', salonId)
          .is('deleted_at', null)
          .order('last_name'),
        supabase.from('client_stats').select('*').eq('salon_id', salonId),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (statsRes.error) throw statsRes.error;

      const statsMap = new Map((statsRes.data ?? []).map((s) => [s.client_id, s]));

      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row aliases narrower than generated types
      return (clientsRes.data ?? []).map((row: any) =>
        // biome-ignore lint/suspicious/noExplicitAny: stats row also narrower than generated
        toClient(row, (statsMap.get(row.id) ?? null) as any),
      );
    },
    enabled: !!salonId,
  });

  const addClientMutation = useMutation({
    mutationFn: async (client: Client) => {
      const { error } = await supabase.from('clients').insert(toClientInsert(client, salonId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le client"),
  });

  const updateClientMutation = useMutation({
    mutationFn: async (client: Client) => {
      const { error } = await supabase
        .from('clients')
        .update(toClientInsert(client, salonId))
        .eq('id', client.id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: toastOnError('Impossible de modifier le client'),
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('soft_delete_client', {
        p_client_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: toastOnError('Impossible de supprimer le client'),
  });

  return {
    clients,
    allClients: clients,
    isLoading,
    addClient: (client: Client) => addClientMutation.mutateAsync(client),
    updateClient: (client: Client) => updateClientMutation.mutateAsync(client),
    deleteClient: (id: string) => deleteClientMutation.mutateAsync(id),
  };
};
