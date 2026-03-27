
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toClient, toClientInsert } from '../mappers';
import type { Client } from '../../../types';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';

export const useClients = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
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
        supabase
          .from('client_stats')
          .select('*'),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (statsRes.error) throw statsRes.error;

      const statsMap = new Map(
        (statsRes.data ?? []).map(s => [s.client_id, s])
      );

      return (clientsRes.data ?? []).map(row =>
        toClient(row, statsMap.get(row.id) ?? null)
      );
    },
    enabled: !!salonId,
  });

  const addClientMutation = useMutation({
    mutationFn: async (client: Client) => {
      const { error } = await supabase
        .from('clients')
        .insert(toClientInsert(client, salonId));
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
        .eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: toastOnError("Impossible de modifier le client"),
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', salonId] });
    },
    onError: toastOnError("Impossible de supprimer le client"),
  });

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(c =>
      c.lastName.toLowerCase().includes(term) ||
      c.firstName.toLowerCase().includes(term) ||
      c.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  return {
    clients: filteredClients,
    allClients: clients,
    isLoading,
    searchTerm,
    setSearchTerm,
    addClient: (client: Client) => addClientMutation.mutate(client),
    updateClient: (client: Client) => updateClientMutation.mutate(client),
    deleteClient: (id: string) => deleteClientMutation.mutate(id),
  };
};
