import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toSupplier, toSupplierInsert, toSupplierCategory } from '../mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { Supplier, SupplierCategory } from '../../../types';

export interface SupplierCategoryUpdatePayload {
  categories: SupplierCategory[];
  assignments?: Record<string, string | null>;
}

export const useSuppliers = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const { toastOnError, toastOnSuccess } = useMutationToast();
  useRealtimeSync('suppliers');
  useRealtimeSync('supplier_categories');

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['suppliers', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toSupplier);
    },
    enabled: !!salonId,
  });

  const { data: supplierCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['supplier_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_categories')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(toSupplierCategory);
    },
    enabled: !!salonId,
  });

  const addSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { error } = await supabase
        .from('suppliers')
        .insert(toSupplierInsert(supplier, salonId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le fournisseur"),
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { id, salon_id, ...updateData } = toSupplierInsert(supplier, salonId);
      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', supplier.id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: toastOnError("Impossible de modifier le fournisseur"),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', supplierId)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
      toastOnSuccess('Fournisseur supprimé')();
    },
    onError: toastOnError('Impossible de supprimer le fournisseur'),
  });

  const updateSupplierCategoriesMutation = useMutation({
    mutationFn: async ({ categories, assignments }: SupplierCategoryUpdatePayload) => {
      const p_categories = categories.map((cat, i) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        sort_order: i,
      }));

      const { error } = await supabase.rpc('save_supplier_categories', {
        p_salon_id: salonId,
        p_categories: p_categories,
        p_assignments: assignments ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_categories', salonId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
      toastOnSuccess('Catégories enregistrées')();
    },
    onError: toastOnError("Impossible de modifier les catégories de fournisseurs"),
  });

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(term) ||
      (s.contactName ?? '').toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  return {
    suppliers: filteredSuppliers,
    allSuppliers: suppliers,
    supplierCategories,
    isLoading: isLoadingSuppliers || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addSupplier: (supplier: Supplier) => addSupplierMutation.mutate(supplier),
    updateSupplier: (supplier: Supplier) => updateSupplierMutation.mutate(supplier),
    deleteSupplier: (supplierId: string) => deleteSupplierMutation.mutate(supplierId),
    updateSupplierCategories: (payload: SupplierCategoryUpdatePayload) =>
      updateSupplierCategoriesMutation.mutate(payload),
  };
};
