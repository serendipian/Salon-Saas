
import React from 'react';
import { Plus, Search, Filter, Layers, ChevronRight, Package } from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';

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
           <button className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-sm shadow-sm">
            <Filter size={16} />
            Filtres
          </button>
        </div>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-3">Produit</th>
                <th className="px-6 py-3">État du stock</th>
                <th className="px-6 py-3">Inventaire</th>
                <th className="px-6 py-3">Prix</th>
                <th className="px-6 py-3">Fournisseur</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => {
                const category = categories.find(c => c.id === product.categoryId);
                let stockStatus = <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-xs font-medium">En stock</span>;
                if (product.stock === 0) stockStatus = <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-xs font-medium">Épuisé</span>;
                else if (product.stock < 10) stockStatus = <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-xs font-medium">Faible</span>;

                return (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(product.id)}>
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                          <Package size={20} />
                        </div>
                        <div>
                           <div className="font-medium text-slate-900 text-sm">{product.name}</div>
                           {category ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border mt-1 ${category.color}`}>
                              {category.name}
                            </span>
                           ) : (
                            <span className="text-xs text-slate-400 italic mt-1 block">Sans catégorie</span>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {stockStatus}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">
                      <div className="font-medium text-slate-900">{product.stock} unités</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">SKU: {product.sku}</div>
                    </td>
                    <td className="px-6 py-4 align-top font-medium text-slate-900 text-sm">
                      {formatPrice(product.price)}
                    </td>
                     <td className="px-6 py-4 align-top text-sm text-slate-500">
                      {product.supplier || '-'}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <button 
                        className="p-1 text-slate-300 hover:text-slate-900 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
