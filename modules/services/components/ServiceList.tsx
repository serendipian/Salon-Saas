
import React from 'react';
import { Plus, Search, Filter, Layers, ChevronRight } from 'lucide-react';
import { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';

interface ServiceListProps {
  services: Service[];
  categories: ServiceCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onManageCategories: () => void;
}

export const ServiceList: React.FC<ServiceListProps> = ({
  services,
  categories,
  searchTerm,
  onSearchChange,
  onAdd,
  onEdit,
  onManageCategories
}) => {

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Services</h1>
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
            Nouveau Service
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher un service..." 
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Catégorie</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Variants</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prix</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((service) => {
                const category = categories.find(c => c.id === service.categoryId);
                const prices = service.variants.map(v => v.price);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);

                return (
                  <tr key={service.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(service.id)}>
                    <td className="px-6 py-4 align-top">
                      <div className="font-semibold text-slate-900 text-sm">{service.name}</div>
                      <div className="text-xs text-slate-500 mt-1 max-w-xs line-clamp-2">{service.description}</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {category ? (
                        <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-medium border ${category.color}`}>
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Non classé</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">
                      {service.variants.length} variant{service.variants.length > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 align-top text-sm font-medium text-slate-900">
                      {minPrice === maxPrice ? `${formatPrice(minPrice)}` : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
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
