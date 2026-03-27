
import React from 'react';
import { Plus, Search, Layers } from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ProductTable } from './ProductTable';
import { ProductCard } from './ProductCard';

interface ProductListProps {
  products: Product[];
  categories: ProductCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onManageCategories: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  categories,
  searchTerm,
  onSearchChange,
  onAdd,
  onEdit,
  onManageCategories
}) => {
  const { viewMode, setViewMode } = useViewMode('products');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Produits</h1>
        <div className="flex gap-3">
           <button
            onClick={onManageCategories}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Layers size={16} />
            Catégories
          </button>
          <button
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Produit
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par nom, SKU..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <ProductTable products={products} categories={categories} onEdit={onEdit} />
        ) : (
          <ProductCard products={products} categories={categories} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
};
