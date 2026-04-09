import React from 'react';
import { Layers, Star } from 'lucide-react';
import { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { EmptyState } from '../../../components/EmptyState';

interface ServiceCardProps {
  services: Service[];
  categories: ServiceCategory[];
  onEdit: (id: string) => void;
  groupByCategory?: boolean;
  canToggleFavorite?: boolean;
  onToggleFavorite?: (type: 'service' | 'variant', id: string, isFavorite: boolean) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  services,
  categories,
  onEdit,
  groupByCategory = false,
  canToggleFavorite = false,
  onToggleFavorite,
}) => {
  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={24} />}
        title="Aucun service trouvé"
        description="Essayez de modifier vos critères de recherche."
      />
    );
  }

  const renderCard = (service: Service, showCategory: boolean) => {
    const category = categories.find(c => c.id === service.categoryId);
    const prices = service.variants.map(v => v.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    return (
      <button
        key={service.id}
        type="button"
        onClick={() => onEdit(service.id)}
        aria-label={`Modifier le service ${service.name}`}
        className="bg-white rounded-xl border border-slate-200 p-4 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="font-semibold text-slate-900 text-sm truncate">
            {service.name}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canToggleFavorite && onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite('service', service.id, !service.isFavorite);
                }}
                className="p-0.5 transition-colors hover:scale-110"
                title={service.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Star
                  size={14}
                  className={service.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}
                />
              </button>
            )}
            {showCategory && (category ? (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border shrink-0 ${category.color}`}>
                <CategoryIcon categoryName={category.name} iconName={category.icon} size={12} />
                {category.name}
              </span>
            ) : (
              <span className="text-slate-400 text-xs italic shrink-0">Non classé</span>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500 mb-3 line-clamp-2">
          {service.description}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {service.variants.length} variant{service.variants.length > 1 ? 's' : ''}
          </span>
          <span className="font-medium text-slate-900">
            {minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
          </span>
        </div>
      </button>
    );
  };

  if (!groupByCategory) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
        {services.map(s => renderCard(s, true))}
      </div>
    );
  }

  // Grouped view
  const groups: { category: ServiceCategory | null; services: Service[] }[] = [
    ...categories
      .filter(cat => services.some(s => s.categoryId === cat.id))
      .map(cat => ({ category: cat, services: services.filter(s => s.categoryId === cat.id) })),
    ...(services.some(s => !categories.find(c => c.id === s.categoryId))
      ? [{ category: null, services: services.filter(s => !categories.find(c => c.id === s.categoryId)) }]
      : []),
  ];

  return (
    <div className="divide-y divide-slate-100">
      {groups.map(group => (
        <div key={group.category?.id ?? 'uncategorized'} className="p-3 space-y-3">
          {/* Category header */}
          <div className="flex items-center gap-2">
            {group.category ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${group.category.color}`}>
                <CategoryIcon categoryName={group.category.name} iconName={group.category.icon} size={12} />
                {group.category.name}
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400 italic">Non classé</span>
            )}
            <span className="text-xs text-slate-400">{group.services.length} service{group.services.length > 1 ? 's' : ''}</span>
          </div>
          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.services.map(s => renderCard(s, false))}
          </div>
        </div>
      ))}
    </div>
  );
};
