import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toProduct, toProductInsert, toProductCategory, toProductCategoryInsert, toBrand } from '../mappers';
import type { Product, ProductCategory, Brand } from '../../../types';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';

export interface CategoryUpdatePayload {
  categories: ProductCategory[];
  assignments?: Record<string, string | null>;
}

export const useProducts = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const { toastOnError, toastOnSuccess } = useMutationToast();
  useRealtimeSync('products');
  useRealtimeSync('product_categories');
  useRealtimeSync('brands');

  // Products query (with supplier + brand names via relation)
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, suppliers(name), brands(name)')
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

  // Brands query (with supplier name)
  const { data: brands = [], isLoading: isLoadingBrands } = useQuery({
    queryKey: ['brands', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*, suppliers(name)')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map(toBrand);
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
    onError: toastOnError("Impossible d'ajouter le produit"),
  });

  // Update product
  const updateProductMutation = useMutation({
    mutationFn: async ({ product, supplierId }: { product: Product; supplierId?: string | null }) => {
      const { id, salon_id, ...updateData } = toProductInsert(product, salonId, supplierId);
      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id)
        .eq('salon_id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: toastOnError("Impossible de modifier le produit"),
  });

  // Update product categories (via RPC for atomic operation)
  const updateProductCategoriesMutation = useMutation({
    mutationFn: async ({ categories, assignments }: CategoryUpdatePayload) => {
      const p_categories = categories.map((cat, i) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        sort_order: i,
      }));

      const { error } = await supabase.rpc('save_product_categories', {
        p_salon_id: salonId,
        p_categories: p_categories,
        p_assignments: assignments ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_categories', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      toastOnSuccess('Catégories enregistrées')();
    },
    onError: toastOnError("Impossible de modifier les catégories de produits"),
  });

  // Update brands (via RPC for atomic operation)
  const updateBrandsMutation = useMutation({
    mutationFn: async (brandList: Brand[]) => {
      const p_brands = brandList.map((b, i) => ({
        id: b.id,
        name: b.name,
        supplier_id: b.supplierId ?? null,
        color: b.color,
        sort_order: i,
      }));

      const { error } = await supabase.rpc('save_brands', {
        p_salon_id: salonId,
        p_brands: p_brands,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands', salonId] });
      toastOnSuccess('Marques enregistrées')();
    },
    onError: toastOnError("Impossible de modifier les marques"),
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
    allProducts: products,
    products: filteredProducts,
    productCategories,
    brands,
    isLoading: isLoadingProducts || isLoadingCategories || isLoadingBrands,
    searchTerm,
    setSearchTerm,
    addProduct: (product: Product, supplierId?: string | null) =>
      addProductMutation.mutate({ product, supplierId }),
    updateProduct: (product: Product, supplierId?: string | null) =>
      updateProductMutation.mutate({ product, supplierId }),
    updateProductCategories: (payload: CategoryUpdatePayload) =>
      updateProductCategoriesMutation.mutate(payload),
    updateBrands: (brandList: Brand[]) =>
      updateBrandsMutation.mutate(brandList),
  };
};
