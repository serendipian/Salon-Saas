import { Plus, Search, Settings } from 'lucide-react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { ViewToggle } from '../../../components/ViewToggle';
import { useSalonPermissions } from '../../../hooks/useSalonPermissions';
import { useViewMode } from '../../../hooks/useViewMode';
import type { Brand, Product, ProductCategory } from '../../../types';
import { ProductCard } from './ProductCard';
import { ProductTable } from './ProductTable';

interface ProductListProps {
  products: Product[];
  categories: ProductCategory[];
  brands: Brand[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  categories,
  brands,
  searchTerm,
  onSearchChange,
  onAdd,
  onEdit,
}) => {
  const navigate = useNavigate();
  const { can } = useSalonPermissions();
  const canEditProducts = can('edit', 'products');
  const { viewMode, setViewMode } = useViewMode('products');

  return (
    <div className="animate-in fade-in">
      <PageHeader
        title="Produits"
        actions={
          <>
            {canEditProducts && (
              <button
                onClick={() => navigate('/products/settings')}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                title="Paramètres des produits"
              >
                <Settings size={18} className="text-slate-600" />
              </button>
            )}
            <button
              onClick={onAdd}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nouveau Produit</span>
            </button>
          </>
        }
      />

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
          <ProductTable
            products={products}
            categories={categories}
            brands={brands}
            onEdit={onEdit}
          />
        ) : (
          <ProductCard
            products={products}
            categories={categories}
            brands={brands}
            onEdit={onEdit}
          />
        )}
      </div>
    </div>
  );
};
