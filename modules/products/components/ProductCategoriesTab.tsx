import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Save, Search } from 'lucide-react';
import { ColorPicker } from '../../services/components/ColorPicker';
import { useProducts } from '../hooks/useProducts';
import type { ProductCategory, Product } from '../../../types';

export function ProductCategoriesTab() {
  const { allProducts, productCategories, updateProductCategories } = useProducts();

  const [localCategories, setLocalCategories] = useState<ProductCategory[]>(productCategories);
  const [localAssignments, setLocalAssignments] = useState<Record<string, string | null>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setSearchTerm('');
  };

  useEffect(() => {
    setLocalCategories(productCategories);
    setLocalAssignments({});
  }, [productCategories]);

  // Build effective categoryId map: start from current product data, overlay local assignments
  const getEffectiveCategoryId = (product: Product): string | null => {
    if (product.id in localAssignments) return localAssignments[product.id];
    return product.categoryId || null;
  };

  const productsForCategory = (categoryId: string) =>
    allProducts.filter((p) => getEffectiveCategoryId(p) === categoryId);

  const unassignedProducts = allProducts.filter((p) => getEffectiveCategoryId(p) === null);

  const filteredProducts = (products: Product[]) => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term));
  };

  const handleAddCategory = () => {
    const newCat: ProductCategory = {
      id: crypto.randomUUID(),
      name: '',
      color: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    setLocalCategories([...localCategories, newCat]);
    setExpandedId(newCat.id);
  };

  const handleDeleteCategory = (id: string) => {
    // Unassign all products from this category
    const affected = allProducts.filter((p) => getEffectiveCategoryId(p) === id);
    const newAssignments = { ...localAssignments };
    affected.forEach((p) => { newAssignments[p.id] = null; });
    setLocalAssignments(newAssignments);
    setLocalCategories(localCategories.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdateCategory = (id: string, updates: Partial<ProductCategory>) => {
    setLocalCategories(localCategories.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localCategories.length) return;
    const updated = [...localCategories];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLocalCategories(updated);
  };

  const handleToggleProduct = (productId: string, categoryId: string) => {
    const current = getEffectiveCategoryId(allProducts.find((p) => p.id === productId)!);
    setLocalAssignments({
      ...localAssignments,
      [productId]: current === categoryId ? null : categoryId,
    });
  };

  const hasChanges =
    JSON.stringify(localCategories) !== JSON.stringify(productCategories) ||
    Object.keys(localAssignments).length > 0;

  const handleSave = () => {
    updateProductCategories({
      categories: localCategories,
      assignments: Object.keys(localAssignments).length > 0 ? localAssignments : undefined,
    });
  };

  const findPreviousCategory = (productId: string): string | null => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product?.categoryId) return null;
    if (product.id in localAssignments && localAssignments[product.id] !== product.categoryId) {
      return productCategories.find((c) => c.id === product.categoryId)?.name ?? null;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {localCategories.map((cat, index) => (
        <div key={cat.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Category row header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'up')}
                disabled={index === 0}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'down')}
                disabled={index === localCategories.length - 1}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowDown size={14} />
              </button>
            </div>

            <ColorPicker
              selectedColor={cat.color}
              onSelect={(color) => handleUpdateCategory(cat.id, { color })}
            />

            <input
              type="text"
              value={cat.name}
              onChange={(e) => handleUpdateCategory(cat.id, { name: e.target.value })}
              placeholder="Nom de la catégorie"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />

            <span className="text-xs text-slate-500 whitespace-nowrap">
              {productsForCategory(cat.id).length} produit{productsForCategory(cat.id).length !== 1 ? 's' : ''}
            </span>

            <button
              type="button"
              onClick={() => handleDeleteCategory(cat.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expandedId === cat.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Expanded: product assignment */}
          {expandedId === cat.id && (
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredProducts(allProducts).map((product) => {
                  const isAssigned = getEffectiveCategoryId(product) === cat.id;
                  const prevCat = !isAssigned ? null : findPreviousCategory(product.id);
                  return (
                    <label
                      key={product.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => handleToggleProduct(product.id, cat.id)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm text-slate-700">{product.name}</span>
                      {prevCat && (
                        <span className="text-xs text-slate-400 italic">(depuis {prevCat})</span>
                      )}
                    </label>
                  );
                })}
                {filteredProducts(allProducts).length === 0 && (
                  <p className="text-sm text-slate-400 py-2 text-center">Aucun produit trouvé</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Unassigned products section */}
      {unassignedProducts.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Produits non classés ({unassignedProducts.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedProducts.map((p) => (
              <span key={p.id} className="text-xs bg-white px-2 py-1 rounded border border-amber-200 text-amber-700">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddCategory}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Plus size={16} />
          Ajouter une catégorie
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            hasChanges
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Save size={16} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}
