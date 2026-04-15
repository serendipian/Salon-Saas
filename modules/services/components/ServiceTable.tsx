import { ChevronRight, Layers } from 'lucide-react';
import React from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { formatPrice } from '../../../lib/format';
import type { Service, ServiceCategory } from '../../../types';
import { useServiceSettings } from '../hooks/useServiceSettings';

interface ServiceTableProps {
  services: Service[];
  categories: ServiceCategory[];
  onEdit: (id: string) => void;
  groupByCategory?: boolean;
}

export const ServiceTable: React.FC<ServiceTableProps> = ({
  services,
  categories,
  onEdit,
  groupByCategory = false,
}) => {
  const { serviceSettings } = useServiceSettings();
  const showCosts = serviceSettings.showCostsInList;
  const colSpan = 3 + (showCosts ? 2 : 0) + 1; // service + category + variants + prix + (cost + margin) + action

  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={24} />}
        title="Aucun service trouvé"
        description="Essayez de modifier vos critères de recherche."
      />
    );
  }

  const renderServiceRow = (service: Service) => {
    const category = categories.find((c) => c.id === service.categoryId);
    const prices = service.variants.map((v) => v.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    return (
      <tr
        key={service.id}
        className="hover:bg-slate-50 transition-colors group cursor-pointer"
        onClick={() => onEdit(service.id)}
      >
        <td className="px-6 py-4 align-top">
          <div className="font-semibold text-slate-900 text-sm">{service.name}</div>
          <div className="text-xs text-slate-500 mt-1 max-w-xs line-clamp-2">
            {service.description}
          </div>
        </td>
        <td className="px-6 py-4 align-top">
          {!groupByCategory &&
            (category ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border ${category.color}`}
              >
                <CategoryIcon categoryName={category.name} iconName={category.icon} size={12} />
                {category.name}
              </span>
            ) : (
              <span className="text-slate-400 text-xs italic">Non classé</span>
            ))}
        </td>
        <td className="px-6 py-4 align-top text-sm text-slate-600 hidden md:table-cell">
          {service.variants.length} variant{service.variants.length > 1 ? 's' : ''}
        </td>
        <td className="px-6 py-4 align-top text-sm font-medium text-slate-900">
          {minPrice === maxPrice
            ? formatPrice(minPrice)
            : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
        </td>
        {showCosts && (
          <td className="hidden sm:table-cell px-6 py-3 text-sm text-slate-600">
            {(() => {
              const costs = service.variants.map((v) => v.cost + v.additionalCost);
              const minCost = Math.min(...costs);
              const maxCost = Math.max(...costs);
              return minCost === maxCost
                ? formatPrice(minCost)
                : `${formatPrice(minCost)} - ${formatPrice(maxCost)}`;
            })()}
          </td>
        )}
        {showCosts && (
          <td className="hidden sm:table-cell px-6 py-3 text-sm font-medium text-emerald-600">
            {(() => {
              const margins = service.variants.map((v) => v.price - v.cost - v.additionalCost);
              const minMargin = Math.min(...margins);
              const maxMargin = Math.max(...margins);
              return minMargin === maxMargin
                ? formatPrice(minMargin)
                : `${formatPrice(minMargin)} - ${formatPrice(maxMargin)}`;
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
  };

  // Build groups sorted by category sort_order
  const groups: { category: ServiceCategory | null; services: Service[] }[] = groupByCategory
    ? [
        ...categories
          .filter((cat) => services.some((s) => s.categoryId === cat.id))
          .map((cat) => ({
            category: cat,
            services: services.filter((s) => s.categoryId === cat.id),
          })),
        ...(services.some((s) => !categories.find((c) => c.id === s.categoryId))
          ? [
              {
                category: null,
                services: services.filter((s) => !categories.find((c) => c.id === s.categoryId)),
              },
            ]
          : []),
      ]
    : [{ category: null, services }];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Service
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {!groupByCategory ? 'Catégorie' : ''}
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
              Variants
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Prix
            </th>
            {showCosts && (
              <th className="hidden sm:table-cell px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Coût
              </th>
            )}
            {showCosts && (
              <th className="hidden sm:table-cell px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Marge
              </th>
            )}
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groups.map((group, i) => (
            <React.Fragment key={group.category?.id ?? 'uncategorized'}>
              {groupByCategory && (
                <tr className={`bg-slate-50 ${i > 0 ? 'border-t-2 border-slate-200' : ''}`}>
                  <td colSpan={colSpan} className="px-6 py-2">
                    {group.category ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${group.category.color}`}
                      >
                        <CategoryIcon
                          categoryName={group.category.name}
                          iconName={group.category.icon}
                          size={12}
                        />
                        {group.category.name}
                        <span className="opacity-60 font-normal">· {group.services.length}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 italic">
                        Non classé
                      </span>
                    )}
                  </td>
                </tr>
              )}
              {group.services.map(renderServiceRow)}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
