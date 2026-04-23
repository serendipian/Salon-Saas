import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { supabase } from '../../../lib/supabase';
import { rawSelect } from '../../../lib/supabaseRaw';
import type { FavoriteItem, Service, ServiceCategory } from '../../../types';
import { toService, toServiceCategory, toServiceInsert, toVariantInsert } from '../mappers';

export interface CategoryUpdatePayload {
  categories: ServiceCategory[];
  assignments?: Record<string, string | null>; // serviceId → categoryId (or null for unassigned)
}

export const useServices = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const { toastOnError, toastOnSuccess } = useMutationToast();
  useRealtimeSync('services');
  useRealtimeSync('service_variants');
  useRealtimeSync('service_categories');

  // Services query (with nested variants)
  const { data: services = [], isLoading: isLoadingServices } = useQuery({
    queryKey: ['services', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*,service_variants(*)');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'name');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('services', params.toString(), signal);
      return data.map((row) => toService(row));
    },
    enabled: !!salonId,
  });

  // Service Categories query
  const { data: serviceCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['service_categories', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'sort_order.asc.nullslast');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('service_categories', params.toString(), signal);
      return data.map((row) => toServiceCategory(row));
    },
    enabled: !!salonId,
  });

  // Add Service (+ variants)
  const addServiceMutation = useMutation({
    mutationFn: async (service: Service) => {
      const serviceRow = toServiceInsert(service, salonId);
      const { data: inserted, error: svcErr } = await supabase
        .from('services')
        .insert(serviceRow)
        .select('id')
        .single();
      if (svcErr) throw svcErr;

      if (service.variants.length > 0) {
        const variantRows = service.variants.map((v, i) =>
          toVariantInsert(v, inserted.id, salonId, i),
        );
        const { error: varErr } = await supabase.from('service_variants').insert(variantRows);
        if (varErr) throw varErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      toastOnSuccess('Service créé')();
    },
    onError: toastOnError("Impossible d'ajouter le service"),
  });

  // Update Service (+ upsert/delete variants)
  const updateServiceMutation = useMutation({
    mutationFn: async (service: Service) => {
      const svcRow = toServiceInsert(service, salonId);
      const { error: svcErr } = await supabase
        .from('services')
        .update(svcRow)
        .eq('id', service.id)
        .eq('salon_id', salonId);
      if (svcErr) throw svcErr;

      // Get existing variant IDs
      const { data: existingVariants, error: fetchErr } = await supabase
        .from('service_variants')
        .select('id')
        .eq('service_id', service.id)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existingVariants ?? []).map((v) => v.id));
      const newIds = new Set(service.variants.filter((v) => v.id).map((v) => v.id));

      // Soft-delete removed variants
      const toDelete = [...existingIds].filter((id) => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('service_variants')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete)
          .eq('salon_id', salonId);
        if (error) throw error;
      }

      // Upsert remaining variants — batched inserts, parallel updates
      const toUpdate: { id: string; row: ReturnType<typeof toVariantInsert> }[] = [];
      const toInsert: ReturnType<typeof toVariantInsert>[] = [];
      for (let i = 0; i < service.variants.length; i++) {
        const v = service.variants[i];
        const row = toVariantInsert(v, service.id, salonId, i);
        if (v.id && existingIds.has(v.id)) {
          toUpdate.push({ id: v.id, row });
        } else {
          toInsert.push(row);
        }
      }

      const updatePromises = toUpdate.map(({ id, row }) =>
        supabase
          .from('service_variants')
          .update({
            name: row.name,
            duration_minutes: row.duration_minutes,
            price: row.price,
            cost: row.cost,
            additional_cost: row.additional_cost,
            sort_order: row.sort_order,
          })
          .eq('id', id)
          .eq('salon_id', salonId)
          .then(({ error }) => {
            if (error) throw error;
          }),
      );

      const insertPromise =
        toInsert.length > 0
          ? supabase
              .from('service_variants')
              .insert(toInsert)
              .then(({ error }) => {
                if (error) throw error;
              })
          : Promise.resolve();

      await Promise.all([...updatePromises, insertPromise]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      toastOnSuccess('Service enregistré')();
    },
    onError: toastOnError('Impossible de modifier le service'),
  });

  // Delete Service (soft-delete via RPC)
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase.rpc('soft_delete_service', {
        p_service_id: serviceId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      toastOnSuccess('Service supprimé')();
    },
    onError: toastOnError('Impossible de supprimer le service'),
  });

  // Update Service Categories (via RPC for atomic operation)
  const updateServiceCategoriesMutation = useMutation({
    mutationFn: async ({ categories, assignments }: CategoryUpdatePayload) => {
      const p_categories = categories.map((cat, i) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon ?? null,
        sort_order: i,
      }));

      const { error } = await supabase.rpc('save_service_categories', {
        p_salon_id: salonId,
        p_categories: p_categories,
        p_assignments: assignments ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_categories', salonId] });
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      toastOnSuccess('Catégories enregistrées')();
    },
    onError: toastOnError('Impossible de modifier les catégories de services'),
  });

  // Toggle Favorite — delegates to the toggle_favorite RPC so the next sort
  // order is computed atomically across services, variants, and packs.
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({
      type,
      id,
      isFavorite,
    }: {
      type: 'service' | 'variant';
      id: string;
      isFavorite: boolean;
    }) => {
      const { error } = await supabase.rpc('toggle_favorite', {
        p_salon_id: salonId,
        p_type: type,
        p_id: id,
        p_is_favorite: isFavorite,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
    },
    onError: toastOnError('Impossible de modifier le favori'),
  });

  // Reorder Favorites (via RPC for atomic operation)
  const reorderFavoritesMutation = useMutation({
    mutationFn: async (
      items: { type: 'service' | 'variant' | 'pack'; id: string; sortOrder: number }[],
    ) => {
      const p_items = items.map((item) => ({
        type: item.type,
        id: item.id,
        sort_order: item.sortOrder,
      }));
      const { error } = await supabase.rpc('reorder_favorites', {
        p_salon_id: salonId,
        p_items: p_items,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      queryClient.invalidateQueries({ queryKey: ['packs', salonId] });
      toastOnSuccess('Ordre des favoris enregistré')();
    },
    onError: toastOnError('Impossible de réordonner les favoris'),
  });

  // Filtering
  const filteredServices = useMemo(() => {
    if (!searchTerm) return services;
    const term = searchTerm.toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(term));
  }, [services, searchTerm]);

  // Favorites derived data
  const favorites = useMemo<FavoriteItem[]>(() => {
    const items: FavoriteItem[] = [];
    const favoritedServiceIds = new Set<string>();

    for (const service of services) {
      if (service.isFavorite) {
        favoritedServiceIds.add(service.id);
        items.push({ type: 'service', service, sortOrder: service.favoriteSortOrder });
      }
    }

    for (const service of services) {
      if (favoritedServiceIds.has(service.id)) continue;
      for (const variant of service.variants) {
        if (variant.isFavorite) {
          items.push({
            type: 'variant',
            variant,
            parentService: service,
            sortOrder: variant.favoriteSortOrder,
          });
        }
      }
    }

    items.sort((a, b) => a.sortOrder - b.sortOrder);
    return items;
  }, [services]);

  return {
    services: filteredServices,
    allServices: services,
    serviceCategories,
    favorites,
    isLoading: isLoadingServices || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addService: (service: Service) => addServiceMutation.mutate(service),
    updateService: (service: Service) => updateServiceMutation.mutate(service),
    deleteService: (serviceId: string) => deleteServiceMutation.mutate(serviceId),
    updateServiceCategories: (payload: CategoryUpdatePayload) =>
      updateServiceCategoriesMutation.mutate(payload),
    toggleFavorite: (params: { type: 'service' | 'variant'; id: string; isFavorite: boolean }) =>
      toggleFavoriteMutation.mutate(params),
    reorderFavorites: (
      items: { type: 'service' | 'variant' | 'pack'; id: string; sortOrder: number }[],
    ) => reorderFavoritesMutation.mutateAsync(items),
  };
};
