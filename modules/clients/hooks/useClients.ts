import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { supabase } from '../../../lib/supabase';
import { rawSelect } from '../../../lib/supabaseRaw';
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
    queryFn: async ({ signal }) => {
      const clientsParams = new URLSearchParams();
      clientsParams.append('select', '*');
      clientsParams.append('salon_id', `eq.${salonId}`);
      clientsParams.append('deleted_at', 'is.null');
      clientsParams.append('order', 'last_name');

      const statsParams = new URLSearchParams();
      statsParams.append('select', '*');
      statsParams.append('salon_id', `eq.${salonId}`);

      const [clientRows, statRows] = await Promise.all([
        // biome-ignore lint/suspicious/noExplicitAny: hand-written Row aliases narrower than generated types
        rawSelect<any>('clients', clientsParams.toString(), signal),
        // biome-ignore lint/suspicious/noExplicitAny: stats row also narrower than generated
        rawSelect<any>('client_stats', statsParams.toString(), signal),
      ]);

      const statsMap = new Map(statRows.map((s) => [s.client_id, s]));
      return clientRows.map((row) => toClient(row, (statsMap.get(row.id) ?? null) as never));
    },
    enabled: !!salonId,
  });

  type ClientsSnapshot = Array<[readonly unknown[], Client[] | undefined]>;
  const restoreSnapshot = (snapshot: ClientsSnapshot | undefined) => {
    if (!snapshot) return;
    for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
  };

  const addClientMutation = useMutation<void, Error, Client, { snapshot: ClientsSnapshot }>({
    mutationFn: async (client) => {
      const { error } = await supabase.from('clients').insert(toClientInsert(client, salonId));
      if (error) throw error;
    },
    onMutate: async (client) => {
      await queryClient.cancelQueries({ queryKey: ['clients', salonId] });
      const snapshot = queryClient.getQueriesData<Client[]>({
        queryKey: ['clients', salonId],
      });
      queryClient.setQueriesData<Client[]>({ queryKey: ['clients', salonId] }, (old) => [
        client,
        ...(old ?? []),
      ]);
      return { snapshot };
    },
    onError: (err, _vars, context) => {
      restoreSnapshot(context?.snapshot);
      toastOnError("Impossible d'ajouter le client")(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
  });

  const updateClientMutation = useMutation<void, Error, Client, { snapshot: ClientsSnapshot }>({
    mutationFn: async (client) => {
      const { error } = await supabase
        .from('clients')
        .update(toClientInsert(client, salonId))
        .eq('id', client.id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onMutate: async (client) => {
      await queryClient.cancelQueries({ queryKey: ['clients', salonId] });
      const snapshot = queryClient.getQueriesData<Client[]>({
        queryKey: ['clients', salonId],
      });
      queryClient.setQueriesData<Client[]>({ queryKey: ['clients', salonId] }, (old) =>
        old?.map((c) => (c.id === client.id ? { ...c, ...client } : c)),
      );
      return { snapshot };
    },
    onError: (err, _vars, context) => {
      restoreSnapshot(context?.snapshot);
      toastOnError('Impossible de modifier le client')(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
  });

  const deleteClientMutation = useMutation<void, Error, string, { snapshot: ClientsSnapshot }>({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('soft_delete_client', {
        p_client_id: id,
      });
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['clients', salonId] });
      const snapshot = queryClient.getQueriesData<Client[]>({
        queryKey: ['clients', salonId],
      });
      queryClient.setQueriesData<Client[]>({ queryKey: ['clients', salonId] }, (old) =>
        old?.filter((c) => c.id !== id),
      );
      return { snapshot };
    },
    onError: (err, _vars, context) => {
      restoreSnapshot(context?.snapshot);
      toastOnError('Impossible de supprimer le client')(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
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
