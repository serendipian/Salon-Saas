import React, { useMemo } from 'react';
import type { Service, ServiceCategory, StaffMember } from '../../../types';
import type { ServiceBlockState } from '../../../types';
import { formatPrice } from '../../../lib/format';
import ServiceGrid from './ServiceGrid';
import StaffPills from './StaffPills';

interface ServiceBlockProps {
  block: ServiceBlockState;
  index: number;
  isActive: boolean;
  services: Service[];
  categories: ServiceCategory[];
  team: StaffMember[];
  onActivate: () => void;
  onRemove: () => void;
  onChange: (updates: Partial<ServiceBlockState>) => void;
  summaryText?: string;
}

export default function ServiceBlock({
  block,
  index,
  isActive,
  services,
  categories,
  team,
  onActivate,
  onRemove,
  onChange,
  summaryText,
}: ServiceBlockProps) {
  const activeCategoryId = block.categoryId || categories[0]?.id || null;

  const filteredServices = useMemo(
    () => services.filter((s) => s.categoryId === activeCategoryId && s.active),
    [services, activeCategoryId],
  );

  const selectedService = useMemo(
    () => services.find((s) => s.id === block.serviceId),
    [services, block.serviceId],
  );

  const handleCategoryChange = (categoryId: string) => {
    onChange({ categoryId, serviceId: null, variantId: null });
  };

  const handleServiceSelect = (serviceId: string) => {
    onChange({
      serviceId,
      variantId: null,
      categoryId: activeCategoryId,
    });
  };

  const handleVariantSelect = (variantId: string) => {
    onChange({ variantId });
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

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  };

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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
      {duration != null && <span>{formatDuration(duration)}</span>}
      {price != null && <span className="text-pink-600 font-semibold">{formatPrice(price)}</span>}
      {block.date && <span>{formatBlockDate(block.date)}</span>}
      {timeRange && <span>{timeRange}</span>}
    </div>
  ) : null;

  // Collapsed (inactive) state
  if (!isActive) {
    return (
      <div
        className="border border-slate-300 rounded-xl p-3.5 cursor-pointer hover:border-slate-400 transition-colors"
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onActivate()}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="bg-slate-300 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0">
              {index + 1}
            </span>
            <span className="text-slate-700 text-sm font-semibold">{selectedService?.name ?? 'Service'}</span>
            {serviceInfoBadge}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-slate-400 hover:text-slate-600 text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Expanded (active) state
  return (
    <div className="border-2 border-pink-400 rounded-xl p-3.5 bg-pink-50">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="bg-pink-400 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {index + 1}
          </span>
          <span className="text-slate-800 text-sm font-semibold">{selectedService?.name ?? 'Service'}</span>
          {serviceInfoBadge}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-slate-600 text-sm flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0 border-b-2 border-slate-200 mb-0 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(cat.id)}
            className={`
              px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors
              ${cat.id === activeCategoryId
                ? 'text-pink-600 border-b-2 border-pink-400 -mb-[2px] font-semibold'
                : 'text-slate-500 hover:text-slate-700'
              }
            `}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Service grid */}
      <ServiceGrid
        services={filteredServices}
        selectedServiceId={block.serviceId}
        selectedVariantId={block.variantId}
        onSelectService={handleServiceSelect}
        onSelectVariant={handleVariantSelect}
      />

      {/* Staff pills (show after service is selected) */}
      {block.serviceId && (
        <div className="mt-3">
          <StaffPills
            team={team}
            categoryId={selectedService?.categoryId ?? null}
            selectedStaffId={block.staffId}
            onSelect={handleStaffSelect}
          />
        </div>
      )}
    </div>
  );
}
