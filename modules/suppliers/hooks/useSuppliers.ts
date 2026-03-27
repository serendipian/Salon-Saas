
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toSupplier, toSupplierInsert } from '../mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import type { Supplier } from '../../../types';

export const useSuppliers = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
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
    onError: (error) => console.error('Failed to add supplier:', error.message),
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { id, salon_id, ...updateData } = toSupplierInsert(supplier, salonId);
      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', supplier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', salonId] });
    },
    onError: (error) => console.error('Failed to update supplier:', error.message),
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
  };
};
