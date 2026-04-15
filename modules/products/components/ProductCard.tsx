import React from 'react';
import { Package } from 'lucide-react';
import { Product, ProductCategory, Brand } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';
import { useProductSettings } from '../hooks/useProductSettings';
import { UsageTypeBadge } from './UsageTypeBadge';

interface ProductCardProps {
  products: Product[];
  categories: ProductCategory[];
  brands?: Brand[];
  onEdit: (id: string) => void;
}

const StockBadge: React.FC<{ stock: number; threshold: number }> = ({ stock, threshold }) => {
  if (stock === 0) {
    return (
      <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-xs font-medium">
        Épuisé
      </span>
    );
  }
  if (stock < threshold) {
    return (
      <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-xs font-medium">
        Faible
      </span>
    );
  }
  return (
    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-xs font-medium">
      En stock
    </span>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({
  products,
  categories,
  brands = [],
  onEdit,
}) => {
  const { productSettings } = useProductSettings();
  const lowStockThreshold = productSettings.lowStockThreshold ?? 10;
  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Package size={24} />}
        title="Aucun produit trouvé"
        description="Ajoutez votre premier produit ou modifiez vos filtres."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {products.map((product) => {
        const category = categories.find((c) => c.id === product.categoryId);
        const brand = brands.find((b) => b.id === product.brandId);

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onEdit(product.id)}
            aria-label={`Modifier ${product.name}`}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus:outline-none"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                <Package size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 text-sm truncate">{product.name}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {category && (
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${category.color}`}
                    >
                      {category.name}
                    </span>
                  )}
                  {brand && (
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${brand.color}`}
                    >
                      {brand.name}
                    </span>
                  )}
                  <UsageTypeBadge usageType={product.usageType} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <StockBadge stock={product.stock} threshold={lowStockThreshold} />
              <span className="font-medium text-slate-900 text-sm">
                {formatPrice(product.price)}
              </span>
            </div>

            <div className="mt-2 text-xs text-slate-400 font-mono">SKU: {product.sku}</div>
          </button>
        );
      })}
    </div>
  );
};
