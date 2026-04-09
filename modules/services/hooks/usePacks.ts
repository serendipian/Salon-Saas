import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { toPack } from '../packMappers';
import { isPackValid } from '../utils/packExpansion';
import type { Pack } from '../../../types';

export function usePacks() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  useRealtimeSync('packs');
  useRealtimeSync('pack_items');

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ['packs', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data, error } = await supabase
        .from('packs')
        .select('*, pack_items(*, services(name), service_variants(name, price, duration_minutes, deleted_at))')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order');

      if (error) throw error;
      return (data ?? []).map(toPack);
    },
    enabled: !!salonId,
  });

  const validPacks = useMemo(
    () => packs.filter((p) => p.active && isPackValid(p)),
    [packs],
  );

  const addPackMutation = useMutation({
    mutationFn: async (pack: { name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
      if (!salonId) throw new Error('No salon');

      const { data: packRow, error: packError } = await supabase
        .from('packs')
        .insert({
          salon_id: salonId,
          name: pack.name,
          description: pack.description || null,
          price: pack.price,
        })
        .select('id')
        .single();

      if (packError) throw packError;

      const itemRows = pack.items.map((item, i) => ({
        pack_id: packRow.id,
        salon_id: salonId,
        service_id: item.serviceId,
        service_variant_id: item.serviceVariantId,
        sort_order: i,
      }));

      const { error: itemsError } = await supabase
        .from('pack_items')
        .insert(itemRows);

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack créé avec succès')();
    },
    onError: toastOnError('Erreur lors de la création du pack'),
  });

  const updatePackMutation = useMutation({
    mutationFn: async (pack: { id: string; name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
      if (!salonId) throw new Error('No salon');

      const { error: packError } = await supabase
        .from('packs')
        .update({
          name: pack.name,
          description: pack.description || null,
          price: pack.price,
        })
        .eq('id', pack.id)
        .eq('salon_id', salonId);

      if (packError) throw packError;

      const { error: deleteError } = await supabase
        .from('pack_items')
        .delete()
        .eq('pack_id', pack.id)
        .eq('salon_id', salonId);

      if (deleteError) throw deleteError;

      const itemRows = pack.items.map((item, i) => ({
        pack_id: pack.id,
        salon_id: salonId,
        service_id: item.serviceId,
        service_variant_id: item.serviceVariantId,
        sort_order: i,
      }));

      const { error: itemsError } = await supabase
        .from('pack_items')
        .insert(itemRows);

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack mis à jour')();
    },
    onError: toastOnError('Erreur lors de la mise à jour du pack'),
  });

  const deletePackMutation = useMutation({
    mutationFn: async (packId: string) => {
      if (!salonId) throw new Error('No salon');
      const { error } = await supabase
        .from('packs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', packId)
        .eq('salon_id', salonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Pack supprimé')();
    },
    onError: toastOnError('Erreur lors de la suppression du pack'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ packId, active }: { packId: string; active: boolean }) => {
      if (!salonId) throw new Error('No salon');
      const { error } = await supabase
        .from('packs')
        .update({ active })
        .eq('id', packId)
        .eq('salon_id', salonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ packId, isFavorite }: { packId: string; isFavorite: boolean }) => {
      if (!salonId) throw new Error('No salon');

      let favoriteOrder: number | null = null;
      if (isFavorite) {
        const { data: maxPack } = await supabase
          .from('packs')
          .select('favorite_sort_order')
          .eq('salon_id', salonId)
          .eq('is_favorite', true)
          .order('favorite_sort_order', { ascending: false })
          .limit(1)
          .single();

        favoriteOrder = (maxPack?.favorite_sort_order ?? 0) + 1;
      }

      const { error } = await supabase
        .from('packs')
        .update({
          is_favorite: isFavorite,
          favorite_sort_order: isFavorite ? favoriteOrder : null,
        })
        .eq('id', packId)
        .eq('salon_id', salonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  return {
    packs,
    validPacks,
    isLoading,
    addPack: addPackMutation.mutate,
    updatePack: updatePackMutation.mutate,
    deletePack: deletePackMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    toggleFavorite: toggleFavoriteMutation.mutate,
    isAdding: addPackMutation.isPending,
    isUpdating: updatePackMutation.isPending,
  };
}
