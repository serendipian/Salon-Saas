import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toProduct, toProductInsert, toProductCategory, toProductCategoryInsert } from '../mappers';
import type { Product, ProductCategory } from '../../../types';

export const useProducts = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Products query (with supplier name via relation)
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, suppliers(name)')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toProduct);
    },
    enabled: !!salonId,
  });

  // Product Categories query
  const { data: productCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['product_categories', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(toProductCategory);
    },
    enabled: !!salonId,
  });

  // Add product
  const addProductMutation = useMutation({
    mutationFn: async ({ product, supplierId }: { product: Product; supplierId?: string | null }) => {
      const { error } = await supabase
        .from('products')
        .insert(toProductInsert(product, salonId, supplierId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: (error) => console.error('Failed to add product:', error.message),
  });

  // Update product
  const updateProductMutation = useMutation({
    mutationFn: async ({ product, supplierId }: { product: Product; supplierId?: string | null }) => {
      const { error } = await supabase
        .from('products')
        .update(toProductInsert(product, salonId, supplierId))
        .eq('id', product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: (error) => console.error('Failed to update product:', error.message),
  });

  // Update product categories (upsert with soft-delete)
  const updateProductCategoriesMutation = useMutation({
    mutationFn: async (categories: ProductCategory[]) => {
      const { data: existing, error: fetchErr } = await supabase
        .from('product_categories')
        .select('id')
        .eq('salon_id', salonId)
        .is('deleted_at', null);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing ?? []).map(c => c.id));
      const newIds = new Set(categories.map(c => c.id));

      // Soft-delete removed categories
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('product_categories')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete);
        if (error) throw error;
      }

      // Upsert remaining categories
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row = toProductCategoryInsert({ ...cat, sortOrder: i }, salonId);
        if (existingIds.has(cat.id)) {
          const { error } = await supabase
            .from('product_categories')
            .update({ name: row.name, color: row.color, sort_order: row.sort_order })
            .eq('id', cat.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('product_categories')
            .insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_categories', salonId] });
    },
    onError: (error) => console.error('Failed to update product categories:', error.message),
  });

  // Filtering
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  return {
    products: filteredProducts,
    productCategories,
    isLoading: isLoadingProducts || isLoadingCategories,
    searchTerm,
    setSearchTerm,
    addProduct: (product: Product, supplierId?: string | null) =>
      addProductMutation.mutate({ product, supplierId }),
    updateProduct: (product: Product, supplierId?: string | null) =>
      updateProductMutation.mutate({ product, supplierId }),
    updateProductCategories: (categories: ProductCategory[]) =>
      updateProductCategoriesMutation.mutate(categories),
  };
};
