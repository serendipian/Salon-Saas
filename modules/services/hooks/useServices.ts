import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  toService, toServiceInsert, toVariantInsert,
  toServiceCategory, toServiceCategoryInsert,
} from '../mappers';
import type { Service, ServiceCategory } from '../../../types';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, service_variants(*)')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toService);
    },
    enabled: !!salonId,
  });

  // Service Categories query
  const { data: serviceCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['service_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(toServiceCategory);
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
          toVariantInsert(v, inserted.id, salonId, i)
        );
        const { error: varErr } = await supabase
          .from('service_variants')
          .insert(variantRows);
        if (varErr) throw varErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
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

      const existingIds = new Set((existingVariants ?? []).map(v => v.id));
      const newIds = new Set(service.variants.filter(v => v.id).map(v => v.id));

      // Soft-delete removed variants
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
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
          .then(({ error }) => { if (error) throw error; })
      );

      const insertPromise = toInsert.length > 0
        ? supabase.from('service_variants').insert(toInsert).then(({ error }) => { if (error) throw error; })
        : Promise.resolve();

      await Promise.all([...updatePromises, insertPromise]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
    },
    onError: toastOnError("Impossible de modifier le service"),
  });

  // Delete Service (soft-delete)
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      // Soft-delete the service
      const { error: svcErr } = await supabase
        .from('services')
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq('id', serviceId)
        .eq('salon_id', salonId);
      if (svcErr) throw svcErr;

      // Soft-delete its variants
      const { error: varErr } = await supabase
        .from('service_variants')
        .update({ deleted_at: new Date().toISOString() })
        .eq('service_id', serviceId)
        .eq('salon_id', salonId);
      if (varErr) throw varErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      toastOnSuccess('Service supprimé')();
    },
    onError: toastOnError("Impossible de supprimer le service"),
  });

  // Update Service Categories (upsert with soft-delete)
  const updateServiceCategoriesMutation = useMutation({
    mutationFn: async ({ categories, assignments }: CategoryUpdatePayload) => {
      const { data: existing, error: fetchErr } = await supabase
        .from('service_categories')
        .select('id')
        .eq('salon_id', salonId)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(c => c.id));
      const newIds = new Set(categories.map(c => c.id));

      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('service_categories')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete)
          .eq('salon_id', salonId);
        if (error) throw error;
      }

      // Batch inserts, parallel updates for categories
      const catUpdates: Promise<void>[] = [];
      const catInserts: ReturnType<typeof toServiceCategoryInsert>[] = [];
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toServiceCategoryInsert({ ...cat, sortOrder: i }, salonId);
        if (existingIds.has(cat.id)) {
          catUpdates.push(
            supabase
              .from('service_categories')
              .update({ name: row.name, color: row.color, icon: row.icon, sort_order: row.sort_order })
              .eq('id', cat.id)
              .eq('salon_id', salonId)
              .then(({ error }) => { if (error) throw error; })
          );
        } else {
          catInserts.push(row);
        }
      }

      const catInsertPromise = catInserts.length > 0
        ? supabase.from('service_categories').insert(catInserts).then(({ error }) => { if (error) throw error; })
        : Promise.resolve();

      await Promise.all([...catUpdates, catInsertPromise]);

      // Parallel service category assignments
      if (assignments) {
        const assignmentPromises = Object.entries(assignments).map(([serviceId, categoryId]) =>
          supabase
            .from('services')
            .update({ category_id: categoryId })
            .eq('id', serviceId)
            .eq('salon_id', salonId)
            .then(({ error }) => { if (error) throw error; })
        );
        await Promise.all(assignmentPromises);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_categories', salonId] });
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
      toastOnSuccess('Catégories enregistrées')();
    },
    onError: toastOnError("Impossible de modifier les catégories de services"),
  });

  // Filtering
  const filteredServices = useMemo(() => {
    if (!searchTerm) return services;
    const term = searchTerm.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(term));
  }, [services, searchTerm]);

  return {
    services: filteredServices,
    allServices: services,
    serviceCategories,
    isLoading: isLoadingServices || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addService: (service: Service) => addServiceMutation.mutate(service),
    updateService: (service: Service) => updateServiceMutation.mutate(service),
    deleteService: (serviceId: string) => deleteServiceMutation.mutate(serviceId),
    updateServiceCategories: (payload: CategoryUpdatePayload) =>
      updateServiceCategoriesMutation.mutate(payload),
  };
};
