import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { rawInsert, rawRpc, rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { Supplier, SupplierCategory } from '../../../types';
import { toSupplier, toSupplierCategory, toSupplierInsert } from '../mappers';

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
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'name.asc');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('suppliers', params.toString(), signal);
      return data.map((row) => toSupplier(row));
    },
    enabled: !!salonId,
  });

  const { data: supplierCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['supplier_categories', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'sort_order.asc.nullslast');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('supplier_categories', params.toString(), signal);
      return data.map(toSupplierCategory);
    },
    enabled: !!salonId,
  });

  const addSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      await rawInsert('suppliers', toSupplierInsert(supplier, salonId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le fournisseur"),
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { id, salon_id, ...updateData } = toSupplierInsert(supplier, salonId);
      const params = new URLSearchParams();
      params.append('id', `eq.${supplier.id}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('suppliers', params.toString(), updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: toastOnError('Impossible de modifier le fournisseur'),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${supplierId}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('suppliers', params.toString(), {
        deleted_at: new Date().toISOString(),
      });
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

      await rawRpc('save_supplier_categories', {
        p_salon_id: salonId,
        p_categories: p_categories,
        p_assignments: assignments ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_categories', salonId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
      toastOnSuccess('Catégories enregistrées')();
    },
    onError: toastOnError('Impossible de modifier les catégories de fournisseurs'),
  });

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) || (s.contactName ?? '').toLowerCase().includes(term),
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
