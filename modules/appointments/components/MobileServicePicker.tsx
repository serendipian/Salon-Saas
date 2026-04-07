import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';

interface MobileServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  initialCategoryId: string | null;
  onSelect: (selection: { serviceId: string; variantId: string; categoryId: string }) => void;
  onClose: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export const MobileServicePicker: React.FC<MobileServicePickerProps> = ({
  services,
  categories,
  initialCategoryId,
  onSelect,
  onClose,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    initialCategoryId ?? categories[0]?.id ?? null
  );
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  const filteredServices = services.filter(
    (s) => s.active && s.categoryId === activeCategoryId
  );

  const handleCategoryTap = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setExpandedServiceId(null);
  };

  const handleServiceTap = (service: Service) => {
    const activeVariants = service.variants;

    if (activeVariants.length === 1) {
      onSelect({
        serviceId: service.id,
        variantId: activeVariants[0].id,
        categoryId: service.categoryId,
      });
      onClose();
      return;
    }

    setExpandedServiceId(
      expandedServiceId === service.id ? null : service.id
    );
  };

  const handleVariantTap = (service: Service, variantId: string) => {
    onSelect({
      serviceId: service.id,
      variantId,
      categoryId: service.categoryId,
    });
    onClose();
  };

  const getServiceSubtitle = (service: Service) => {
    const parts: string[] = [];
    if (service.variants.length > 1) {
      parts.push(`${service.variants.length} variantes`);
    }
    const duration = service.durationMinutes ?? service.variants[0]?.durationMinutes;
    if (duration) parts.push(formatDuration(duration));
    const price = service.price ?? service.variants[0]?.price;
    if (price != null) parts.push(formatPrice(price));
    return parts.join(' · ');
  };

  return (
    <div>
      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-5 px-5 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryTap(cat.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
              activeCategoryId === cat.id
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <CategoryIcon
              categoryName={cat.name}
              iconName={cat.icon}
              size={14}
              className={activeCategoryId === cat.id ? 'text-white' : 'text-slate-500'}
            />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="flex flex-col gap-2">
        {filteredServices.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">
            Aucun service dans cette catégorie
          </p>
        )}

        {filteredServices.map((service) => {
          const isExpanded = expandedServiceId === service.id;

          return (
            <div key={service.id}>
              <button
                type="button"
                onClick={() => handleServiceTap(service)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl min-h-[52px] transition-colors ${
                  isExpanded
                    ? 'bg-blue-50 border-2 border-blue-400'
                    : 'bg-white border border-slate-200'
                }`}
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-slate-900">
                    {service.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {getServiceSubtitle(service)}
                  </div>
                </div>
                {service.variants.length === 1 && (
                  <Check size={16} className="text-slate-400 shrink-0 ml-2" />
                )}
              </button>

              {/* Variant list (multi-variant expansion) */}
              {isExpanded && service.variants.length > 1 && (
                <div className="ml-3 mt-2 flex flex-col gap-1.5">
                  {service.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => handleVariantTap(service, variant.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200 min-h-[48px] transition-colors active:bg-slate-50"
                    >
                      <div className="text-left">
                        <span className="text-sm font-medium text-slate-900">
                          {variant.name}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          {formatDuration(variant.durationMinutes)}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-blue-600 shrink-0 ml-2">
                        {formatPrice(variant.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
