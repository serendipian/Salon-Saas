import React from 'react';
import { Layers } from 'lucide-react';
import { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

interface ServiceCardProps {
  services: Service[];
  categories: ServiceCategory[];
  onEdit: (id: string) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  services,
  categories,
  onEdit,
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {services.map((service) => {
        const category = categories.find(c => c.id === service.categoryId);
        const prices = service.variants.map(v => v.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onEdit(service.id)}
            aria-label={`Modifier le service ${service.name}`}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            {/* Header: name + category */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-semibold text-slate-900 text-sm truncate">
                {service.name}
              </div>
              {category ? (
                <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-medium border shrink-0 ${category.color}`}>
                  {category.name}
                </span>
              ) : (
                <span className="text-slate-400 text-xs italic shrink-0">Non classé</span>
              )}
            </div>

            {/* Description */}
            <div className="text-xs text-slate-500 mb-3 line-clamp-2">
              {service.description}
            </div>

            {/* Stats: variants + price */}
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
      })}
    </div>
  );
};
