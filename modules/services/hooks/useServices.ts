import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  toService, toServiceInsert, toVariantInsert,
  toServiceCategory, toServiceCategoryInsert,
} from '../mappers';
import type { Service, ServiceCategory } from '../../../types';

export const useServices = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

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
    onError: (error) => console.error('Failed to add service:', error.message),
  });

  // Update Service (+ upsert/delete variants)
  const updateServiceMutation = useMutation({
    mutationFn: async (service: Service) => {
      const { error: svcErr } = await supabase
        .from('services')
        .update(toServiceInsert(service, salonId))
        .eq('id', service.id);
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
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining variants
      for (let i = 0; i < service.variants.length; i++) {
        const v = service.variants[i];
        const row = toVariantInsert(v, service.id, salonId, i);
        if (v.id && existingIds.has(v.id)) {
          const { error } = await supabase
            .from('service_variants')
            .update({
              name: row.name,
              duration_minutes: row.duration_minutes,
              price: row.price,
              cost: row.cost,
              sort_order: row.sort_order,
            })
            .eq('id', v.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('service_variants')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', salonId] });
    },
    onError: (error) => console.error('Failed to update service:', error.message),
  });

  // Update Service Categories (upsert with soft-delete)
  const updateServiceCategoriesMutation = useMutation({
    mutationFn: async (categories: ServiceCategory[]) => {
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
          .in('id', toDelete);
        if (error) throw error;
      }

      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toServiceCategoryInsert({ ...cat, sortOrder: i }, salonId);
        if (existingIds.has(cat.id)) {
          const { error } = await supabase
            .from('service_categories')
            .update({ name: row.name, color: row.color, sort_order: row.sort_order })
            .eq('id', cat.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('service_categories')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_categories', salonId] });
    },
    onError: (error) => console.error('Failed to update service categories:', error.message),
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
    updateServiceCategories: (categories: ServiceCategory[]) =>
      updateServiceCategoriesMutation.mutate(categories),
  };
};
