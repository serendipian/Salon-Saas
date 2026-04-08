
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toSupplier, toSupplierInsert } from '../mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { Supplier } from '../../../types';

export const useSuppliers = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const { toastOnError, toastOnSuccess } = useMutationToast();
  useRealtimeSync('suppliers');

  const { data: suppliers = [], isLoading } = useQuery({
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
    isLoading,
    searchTerm,
    setSearchTerm,
    addSupplier: (supplier: Supplier) => addSupplierMutation.mutate(supplier),
    updateSupplier: (supplier: Supplier) => updateSupplierMutation.mutate(supplier),
    deleteSupplier: (supplierId: string) => deleteSupplierMutation.mutate(supplierId),
  };
};
