import React from 'react';
import { ChevronRight, Package } from 'lucide-react';
import { Product, ProductCategory, Brand } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';
import { useProductSettings } from '../hooks/useProductSettings';
import { UsageTypeBadge } from './UsageTypeBadge';

interface ProductTableProps {
  products: Product[];
  categories: ProductCategory[];
  brands?: Brand[];
  onEdit: (id: string) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
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
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Produit</th>
            <th className="px-6 py-3">État du stock</th>
            <th className="px-6 py-3 hidden md:table-cell">Inventaire</th>
            <th className="px-6 py-3">Prix</th>
            <th className="px-6 py-3 hidden lg:table-cell">Fournisseur</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((product) => {
            const category = categories.find((c) => c.id === product.categoryId);
            const brand = brands.find((b) => b.id === product.brandId);
            let stockStatus = (
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-xs font-medium">
                En stock
              </span>
            );
            if (product.stock === 0)
              stockStatus = (
                <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-xs font-medium">
                  Épuisé
                </span>
              );
            else if (product.stock < lowStockThreshold)
              stockStatus = (
                <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-xs font-medium">
                  Faible
                </span>
              );

            return (
              <tr
                key={product.id}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => onEdit(product.id)}
              >
                <td className="px-6 py-4 align-top">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                      <Package size={20} />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{product.name}</div>
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
                </td>
                <td className="px-6 py-4 align-top">{stockStatus}</td>
                <td className="px-6 py-4 align-top text-sm text-slate-600 hidden md:table-cell">
                  <div className="font-medium text-slate-900">{product.stock} unités</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">SKU: {product.sku}</div>
                </td>
                <td className="px-6 py-4 align-top font-medium text-slate-900 text-sm">
                  {formatPrice(product.price)}
                </td>
                <td className="px-6 py-4 align-top text-sm text-slate-500 hidden lg:table-cell">
                  {product.supplier || '-'}
                </td>
                <td className="px-6 py-4 align-top text-right">
                  <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
