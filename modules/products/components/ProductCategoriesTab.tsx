// Thin wrapper around the shared CategoriesManager generic. The previously
// duplicated 251-LOC implementation moved to components/CategoriesManager.tsx
// during M-25 — see audit-remaining-items.md for the rationale.

import React from 'react';
import { CategoriesManager } from '../../../components/CategoriesManager';
import { useProducts } from '../hooks/useProducts';
import type { ProductCategory } from '../../../types';

export function ProductCategoriesTab() {
  const { allProducts, productCategories, updateProductCategories } = useProducts();

  const createCategory = (): ProductCategory => ({
    id: crypto.randomUUID(),
    name: '',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
  });

  return (
    <CategoriesManager
      items={allProducts}
      categories={productCategories}
      onSave={updateProductCategories}
      createCategory={createCategory}
      itemLabel={{ singular: 'produit', plural: 'produits' }}
      searchPlaceholder="Rechercher un produit..."
      noItemsFoundLabel="Aucun produit trouvé"
      unassignedSectionLabel="Produits non classés"
    />
  );
}
