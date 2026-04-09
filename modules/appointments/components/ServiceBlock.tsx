import React, { useMemo, useState } from 'react';
import type { Service, ServiceCategory, StaffMember, FavoriteItem, Pack } from '../../../types';
import type { ServiceBlockState } from '../../../types';
import { formatPrice, formatDuration } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { getPackDiscount } from '../../services/utils/packExpansion';
import ServiceGrid from './ServiceGrid';
import StaffPills from './StaffPills';
import { X, Clock, Calendar, Star, Package } from 'lucide-react';

interface ServiceBlockProps {
  block: ServiceBlockState;
  index: number;
  isActive: boolean;
  services: Service[];
  categories: ServiceCategory[];
  favorites: FavoriteItem[];
  team: StaffMember[];
  onActivate: () => void;
  onRemove: () => void;
  onChange: (updates: Partial<ServiceBlockState>) => void;
  summaryText?: string;
  packs?: Pack[];
  onAddPackBlocks?: (pack: Pack) => void;
  stepOffset?: number;
}

export default function ServiceBlock({
  block,
  index,
  isActive,
  services,
  categories,
  favorites,
  team,
  onActivate,
  onRemove,
  onChange,
  summaryText,
  packs = [],
  onAddPackBlocks,
  stepOffset = 0,
}: ServiceBlockProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(() => {
    // If the block already has a service selected (e.g. from a pack or during edit),
    // open the tab matching that service's category so the selection stays visible.
    if (block.serviceId) {
      const svc = services.find((s) => s.id === block.serviceId);
      if (svc?.categoryId) return svc.categoryId;
    }
    if (block.categoryId) return block.categoryId;
    if (favorites.length > 0) return 'FAVORITES';
    return categories[0]?.id || '';
  });

  const filteredServices = useMemo(
    () => activeCategoryId === 'FAVORITES'
      ? []
      : services.filter((s) => s.categoryId === activeCategoryId && s.active),
    [services, activeCategoryId],
  );

  const selectedService = useMemo(
    () => services.find((s) => s.id === block.serviceId),
    [services, block.serviceId],
  );

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    onChange({ categoryId: categoryId === 'FAVORITES' ? null : categoryId, serviceId: null, variantId: null });
  };

  const handleServiceSelect = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    onChange({
      serviceId,
      variantId: null,
      categoryId: svc?.categoryId || activeCategoryId,
    });
  };

  const handleVariantSelect = (variantId: string, serviceId?: string) => {
    if (serviceId) {
      onChange({ variantId, serviceId });
    } else {
      onChange({ variantId });
    }
  };

  const handleStaffSelect = (staffId: string | null) => {
    onChange({ staffId });
  };

  // Service info for header
  const variant = useMemo(
    () => selectedService?.variants.find((v) => v.id === block.variantId) ?? null,
    [selectedService, block.variantId],
  );
  const duration = variant?.durationMinutes ?? selectedService?.durationMinutes ?? null;
  const price = variant?.price ?? selectedService?.price ?? null;

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const formatBlockDate = (dateStr: string) => dateFmt.format(new Date(dateStr + 'T00:00:00'));

  const timeRange = useMemo(() => {
    if (block.hour === null || !duration) return null;
    const start = `${block.hour}h${String(block.minute).padStart(2, '0')}`;
    const endTotal = block.hour * 60 + block.minute + duration;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    return `${start} – ${endH}h${String(endM).padStart(2, '0')}`;
  }, [block.hour, block.minute, duration]);

  const serviceInfoBadge = block.serviceId ? (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      {duration != null && (
        <span className="flex items-center gap-0.5">
          <Clock size={10} /> {formatDuration(duration)}
        </span>
      )}
      {price != null && <span className="text-blue-600 font-semibold">{formatPrice(price)}</span>}
      {block.date && (
        <span className="flex items-center gap-0.5">
          <Calendar size={10} /> {formatBlockDate(block.date)}
        </span>
      )}
      {timeRange && <span>{timeRange}</span>}
    </div>
  ) : null;

  // Collapsed (inactive) state
  if (!isActive) {
    return (
      <div
        className="border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all bg-white"
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onActivate()}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {index + 1 + stepOffset}
            </span>
            <span className="text-slate-700 text-sm font-medium">{selectedService?.name ?? 'Service'}</span>
            {serviceInfoBadge}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <X size={14} className="text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded (active) state
  return (
    <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
            {index + 1 + stepOffset}
          </span>
          <span className="text-slate-900 text-sm font-semibold">{selectedService?.name ?? 'Service'}</span>
          {serviceInfoBadge}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-full hover:bg-white/80 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      {/* Category buttons */}
      <div className="flex gap-2 flex-wrap mb-3">
        {favorites.length > 0 && (
          <button
            type="button"
            onClick={() => handleCategoryChange('FAVORITES')}
            className={`
              px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
              ${activeCategoryId === 'FAVORITES'
                ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
              }
            `}
          >
            <Star size={14} className={activeCategoryId === 'FAVORITES' ? 'fill-amber-400 text-amber-400' : ''} />
            Favoris
          </button>
        )}
        {packs.length > 0 && (
          <button
            type="button"
            onClick={() => handleCategoryChange('PACKS')}
            className={`
              px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
              ${activeCategoryId === 'PACKS'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
              }
            `}
          >
            <Package size={14} />
            Packs
          </button>
        )}
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(cat.id)}
            className={`
              px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
              ${cat.id === activeCategoryId
                ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
              }
            `}
          >
            <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={14} className="shrink-0" />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Service grid */}
      {activeCategoryId !== 'PACKS' && (
        <ServiceGrid
          services={filteredServices}
          favorites={activeCategoryId === 'FAVORITES' ? favorites : []}
          categories={categories}
          selectedServiceId={block.serviceId}
          selectedVariantId={block.variantId}
          onSelectService={handleServiceSelect}
          onSelectVariant={handleVariantSelect}
        />
      )}

      {/* Packs grid */}
      {activeCategoryId === 'PACKS' && (
        <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2 mt-3">
          {packs.map((pack) => {
            const discount = getPackDiscount(pack);
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => onAddPackBlocks?.(pack)}
                className="bg-white p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
              >
                <div className="text-xs text-emerald-600 font-medium mb-1">
                  {pack.items.length} service{pack.items.length !== 1 ? 's' : ''}
                  {discount > 0 && ` · -${discount}%`}
                </div>
                <div className="text-sm font-medium text-slate-900 truncate">{pack.name}</div>
                <div className="text-sm font-semibold text-slate-700 mt-1">{formatPrice(pack.price)}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Staff pills (show after service is selected) */}
      {block.serviceId && (
        <div className="mt-4 pt-4 border-t border-slate-200/60">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">3</span>
            <span className="text-slate-900 text-sm font-semibold">Praticien</span>
          </div>
          <StaffPills
            team={team}
            categoryId={selectedService?.categoryId ?? null}
            selectedStaffId={block.staffId}
            onSelect={handleStaffSelect}
            hideLabel
          />
        </div>
      )}
    </div>
  );
}
