import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { supabase } from '../../../lib/supabase';
import { rawSelect } from '../../../lib/supabaseRaw';
import { toPackGroup } from '../packMappers';

export function usePackGroups() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  useRealtimeSync('pack_groups');

  const { data: packGroups = [], isLoading } = useQuery({
    queryKey: ['pack_groups', salonId],
    queryFn: async ({ signal }) => {
      if (!salonId) return [];
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('order', 'sort_order');
      // biome-ignore lint/suspicious/noExplicitAny: toPackGroup accepts row shape narrower than generated types
      const data = await rawSelect<any>('pack_groups', params.toString(), signal);
      return data.map(toPackGroup);
    },
    enabled: !!salonId,
  });

  const addPackGroupMutation = useMutation({
    mutationFn: async (group: {
      name: string;
      description: string;
      color: string | null;
      startsAt: string | null;
      endsAt: string | null;
    }) => {
      if (!salonId) throw new Error('No salon');
      const { error } = await supabase.from('pack_groups').insert({
        salon_id: salonId,
        name: group.name,
        description: group.description || null,
        color: group.color,
        starts_at: group.startsAt,
        ends_at: group.endsAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack_groups', salonId] });
      toastOnSuccess('Groupe créé')();
    },
    onError: toastOnError('Erreur lors de la création du groupe'),
  });

  const updatePackGroupMutation = useMutation({
    mutationFn: async (group: {
      id: string;
      name: string;
      description: string;
      color: string | null;
      startsAt: string | null;
      endsAt: string | null;
    }) => {
      if (!salonId) throw new Error('No salon');
      const { error } = await supabase
        .from('pack_groups')
        .update({
          name: group.name,
          description: group.description || null,
          color: group.color,
          starts_at: group.startsAt,
          ends_at: group.endsAt,
        })
        .eq('id', group.id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack_groups', salonId] });
      toastOnSuccess('Groupe mis à jour')();
    },
    onError: toastOnError('Erreur lors de la mise à jour du groupe'),
  });

  const deletePackGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!salonId) throw new Error('No salon');
      // FK is ON DELETE SET NULL → packs in the group simply become ungrouped.
      const { error } = await supabase
        .from('pack_groups')
        .delete()
        .eq('id', groupId)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack_groups', salonId] });
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Groupe supprimé')();
    },
    onError: toastOnError('Erreur lors de la suppression du groupe'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ groupId, active }: { groupId: string; active: boolean }) => {
      if (!salonId) throw new Error('No salon');
      const { error } = await supabase
        .from('pack_groups')
        .update({ active })
        .eq('id', groupId)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack_groups', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  return {
    packGroups,
    isLoading,
    addPackGroup: addPackGroupMutation.mutate,
    updatePackGroup: updatePackGroupMutation.mutate,
    deletePackGroup: deletePackGroupMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
  };
}
