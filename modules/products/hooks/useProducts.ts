import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { rawInsert, rawRpc, rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { Brand, Product, ProductCategory } from '../../../types';
import { toBrand, toProduct, toProductCategory, toProductInsert } from '../mappers';

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
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*,suppliers(name),brands(name)');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'name');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('products', params.toString(), signal);
      return data.map((row) => toProduct(row));
    },
    enabled: !!salonId,
  });

  // Product Categories query
  const { data: productCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['product_categories', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'sort_order.asc.nullslast');
      // biome-ignore lint/suspicious/noExplicitAny: hand-written Row alias narrower than generated types
      const data = await rawSelect<any>('product_categories', params.toString(), signal);
      return data.map((row) => toProductCategory(row));
    },
    enabled: !!salonId,
  });

  // Brands query (with supplier name)
  const { data: brands = [], isLoading: isLoadingBrands } = useQuery({
    queryKey: ['brands', salonId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*,suppliers(name)');
      params.append('salon_id', `eq.${salonId}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'sort_order.asc.nullslast');
      // biome-ignore lint/suspicious/noExplicitAny: toBrand accepts row shape narrower than generated types
      const data = await rawSelect<any>('brands', params.toString(), signal);
      return data.map(toBrand);
    },
    enabled: !!salonId,
  });

  // Add product
  const addProductMutation = useMutation({
    mutationFn: async ({
      product,
      supplierId,
    }: {
      product: Product;
      supplierId?: string | null;
    }) => {
      await rawInsert('products', toProductInsert(product, salonId, supplierId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      toastOnSuccess('Produit créé')();
    },
    onError: toastOnError("Impossible d'ajouter le produit"),
  });

  // Update product
  const updateProductMutation = useMutation({
    mutationFn: async ({
      product,
      supplierId,
    }: {
      product: Product;
      supplierId?: string | null;
    }) => {
      const { salon_id, ...updateData } = toProductInsert(product, salonId, supplierId);
      const params = new URLSearchParams();
      params.append('id', `eq.${product.id}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('products', params.toString(), updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      toastOnSuccess('Produit enregistré')();
    },
    onError: toastOnError('Impossible de modifier le produit'),
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

      await rawRpc('save_product_categories', {
        p_salon_id: salonId,
        p_categories: p_categories,
        p_assignments: assignments ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_categories', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      toastOnSuccess('Catégories enregistrées')();
    },
    onError: toastOnError('Impossible de modifier les catégories de produits'),
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

      await rawRpc('save_brands', {
        p_salon_id: salonId,
        p_brands: p_brands,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands', salonId] });
      toastOnSuccess('Marques enregistrées')();
    },
    onError: toastOnError('Impossible de modifier les marques'),
  });

  // Delete product (soft-delete via deleted_at)
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${productId}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('products', params.toString(), {
        deleted_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      toastOnSuccess('Produit supprimé')();
    },
    onError: toastOnError('Impossible de supprimer le produit'),
  });

  // Filtering
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term),
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
    deleteProduct: (productId: string) => deleteProductMutation.mutate(productId),
    updateBrands: (brandList: Brand[]) => updateBrandsMutation.mutate(brandList),
  };
};
