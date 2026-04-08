import React, { useMemo } from 'react';
import type { Service, ServiceCategory, StaffMember } from '../../../types';
import type { ServiceBlockState } from '../../../types';
import { formatPrice, formatDuration } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import ServiceGrid from './ServiceGrid';
import StaffPills from './StaffPills';
import { X, Clock, Calendar } from 'lucide-react';

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
              {index + 1}
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
            {index + 1}
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

      {/* Category tabs */}
      <div className="flex gap-0 border-b border-slate-200 mb-0 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(cat.id)}
            className={`
              px-3 py-2 text-xs whitespace-nowrap transition-colors flex items-center gap-1.5
              ${cat.id === activeCategoryId
                ? 'text-blue-600 border-b-2 border-blue-500 -mb-[1px] font-semibold'
                : 'text-slate-500 hover:text-slate-700'
              }
            `}
          >
            <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={13} className="shrink-0" />
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
