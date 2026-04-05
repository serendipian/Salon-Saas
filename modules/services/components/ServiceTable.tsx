import React from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { EmptyState } from '../../../components/EmptyState';
import { useServiceSettings } from '../hooks/useServiceSettings';

interface ServiceTableProps {
  services: Service[];
  categories: ServiceCategory[];
  onEdit: (id: string) => void;
}

export const ServiceTable: React.FC<ServiceTableProps> = ({
  services,
  categories,
  onEdit,
}) => {
  const { serviceSettings } = useServiceSettings();
  const showCosts = serviceSettings.showCostsInList;

  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={24} />}
        title="Aucun service trouvé"
        description="Essayez de modifier vos critères de recherche."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Service</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Catégorie</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Variants</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prix</th>
            {showCosts && <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Coût</th>}
            {showCosts && <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Marge</th>}
            <th className="px-6 py-3 text-right"></th>
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
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border ${category.color}`}>
                      <CategoryIcon categoryName={category.name} iconName={category.icon} size={12} />
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Non classé</span>
                  )}
                </td>
                <td className="px-6 py-4 align-top text-sm text-slate-600 hidden md:table-cell">
                  {service.variants.length} variant{service.variants.length > 1 ? 's' : ''}
                </td>
                <td className="px-6 py-4 align-top text-sm font-medium text-slate-900">
                  {minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
                </td>
                {showCosts && (
                  <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-600">
                    {(() => {
                      const costs = service.variants.map((v) => v.cost + v.additionalCost);
                      const minCost = Math.min(...costs);
                      const maxCost = Math.max(...costs);
                      return minCost === maxCost ? formatPrice(minCost) : `${formatPrice(minCost)} - ${formatPrice(maxCost)}`;
                    })()}
                  </td>
                )}
                {showCosts && (
                  <td className="hidden sm:table-cell px-4 py-3 text-sm font-medium text-emerald-600">
                    {(() => {
                      const margins = service.variants.map((v) => v.price - v.cost - v.additionalCost);
                      const minMargin = Math.min(...margins);
                      const maxMargin = Math.max(...margins);
                      return minMargin === maxMargin ? formatPrice(minMargin) : `${formatPrice(minMargin)} - ${formatPrice(maxMargin)}`;
                    })()}
                  </td>
                )}
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
