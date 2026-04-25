import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import {
  rawDelete,
  rawInsert,
  rawInsertReturning,
  rawRpc,
  rawSelect,
  rawUpdate,
} from '../../../lib/supabaseRaw';
import { toPack } from '../packMappers';
import { isPackValid, isPackVisible } from '../utils/packExpansion';
import { usePackGroups } from './usePackGroups';

export function usePacks() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();
  const { packGroups, isLoading: groupsLoading } = usePackGroups();

  useRealtimeSync('packs');
  useRealtimeSync('pack_items');

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ['packs', salonId],
    queryFn: async ({ signal }) => {
      if (!salonId) return [];
      const params = new URLSearchParams();
      params.append(
        'select',
        '*,pack_items(*,services(name),service_variants(name,price,duration_minutes,deleted_at))',
      );
      params.append('salon_id', `eq.${salonId}`);
      params.append('order', 'sort_order');
      // biome-ignore lint/suspicious/noExplicitAny: toPack accepts row shape narrower than generated types
      const data = await rawSelect<any>('packs', params.toString(), signal);
      return data.map(toPack);
    },
    enabled: !!salonId,
  });

  // validPacks = customer-facing: pack is valid + visible (active, and group is live if grouped).
  // While groups are still loading we return [] to avoid briefly leaking packs
  // whose group is inactive (they'd look "orphaned" until the groups query resolves).
  const validPacks = useMemo(
    () =>
      groupsLoading ? [] : packs.filter((p) => isPackValid(p) && isPackVisible(p, packGroups)),
    [packs, packGroups, groupsLoading],
  );

  const addPackMutation = useMutation({
    mutationFn: async (pack: {
      name: string;
      description: string;
      price: number;
      groupId: string | null;
      items: Array<{ serviceId: string; serviceVariantId: string }>;
    }) => {
      if (!salonId) throw new Error('No salon');

      const inserted = await rawInsertReturning<{ id: string }>(
        'packs',
        {
          salon_id: salonId,
          name: pack.name,
          description: pack.description || null,
          price: pack.price,
          pack_group_id: pack.groupId,
        },
        'id',
      );
      const packId = inserted[0]?.id;
      if (!packId) throw new Error('Pack insert returned no id');

      const itemRows = pack.items.map((item, i) => ({
        pack_id: packId,
        salon_id: salonId,
        service_id: item.serviceId,
        service_variant_id: item.serviceVariantId,
        sort_order: i,
      }));

      await rawInsert('pack_items', itemRows);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack créé avec succès')();
    },
    onError: toastOnError('Erreur lors de la création du pack'),
  });

  const updatePackMutation = useMutation({
    mutationFn: async (pack: {
      id: string;
      name: string;
      description: string;
      price: number;
      groupId: string | null;
      items: Array<{ serviceId: string; serviceVariantId: string }>;
    }) => {
      if (!salonId) throw new Error('No salon');

      const params = new URLSearchParams();
      params.append('id', `eq.${pack.id}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('packs', params.toString(), {
        name: pack.name,
        description: pack.description || null,
        price: pack.price,
        pack_group_id: pack.groupId,
      });

      // Atomic item replacement via RPC to prevent orphaned packs on partial failure
      const itemsJson = pack.items.map((item, i) => ({
        service_id: item.serviceId,
        service_variant_id: item.serviceVariantId,
        sort_order: i,
      }));

      await rawRpc('replace_pack_items', {
        p_pack_id: pack.id,
        p_salon_id: salonId,
        p_items: itemsJson,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack mis à jour')();
    },
    onError: toastOnError('Erreur lors de la mise à jour du pack'),
  });

  const deletePackMutation = useMutation({
    mutationFn: async (packId: string) => {
      if (!salonId) throw new Error('No salon');
      // Hard delete: packs have no persistent references outside pack_items
      // (which cascades). The audit trigger still records the full row state.
      const params = new URLSearchParams();
      params.append('id', `eq.${packId}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawDelete('packs', params.toString());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack supprimé')();
    },
    onError: toastOnError('Erreur lors de la suppression du pack'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ packId, active }: { packId: string; active: boolean }) => {
      if (!salonId) throw new Error('No salon');
      const params = new URLSearchParams();
      params.append('id', `eq.${packId}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('packs', params.toString(), { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  // Toggle Favorite — delegates to the toggle_favorite RPC so the next sort
  // order is computed atomically across services, variants, and packs.
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ packId, isFavorite }: { packId: string; isFavorite: boolean }) => {
      if (!salonId) throw new Error('No salon');
      await rawRpc('toggle_favorite', {
        p_salon_id: salonId,
        p_type: 'pack',
        p_id: packId,
        p_is_favorite: isFavorite,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  return {
    packs,
    validPacks,
    isLoading,
    addPack: addPackMutation.mutate,
    addPackAsync: addPackMutation.mutateAsync,
    updatePack: updatePackMutation.mutate,
    updatePackAsync: updatePackMutation.mutateAsync,
    deletePack: deletePackMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    toggleFavorite: toggleFavoriteMutation.mutate,
    isAdding: addPackMutation.isPending,
    isUpdating: updatePackMutation.isPending,
  };
}
