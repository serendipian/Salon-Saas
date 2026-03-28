import React, { useMemo } from 'react';
import type { Service, ServiceCategory, StaffMember } from '../../../types';
import type { ServiceBlockState } from '../../../types';
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
  // Summary info for collapsed state
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
    const svc = services.find((s) => s.id === serviceId);
    const firstVariantId = svc?.variants[0]?.id ?? null;
    onChange({
      serviceId,
      variantId: firstVariantId,
      categoryId: activeCategoryId,
    });
  };

  const handleVariantSelect = (variantId: string) => {
    onChange({ variantId });
  };

  const handleStaffSelect = (staffId: string | null) => {
    onChange({ staffId });
  };

  // Collapsed (inactive) state
  if (!isActive) {
    return (
      <div
        className="border border-slate-600 rounded-xl p-3.5 cursor-pointer hover:border-slate-500 transition-colors"
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onActivate()}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-slate-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
              {index + 1}
            </span>
            <span className="text-slate-300 text-sm font-semibold">Service</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-slate-500 hover:text-slate-300 text-sm"
          >
            ✕
          </button>
        </div>
        {summaryText && (
          <div className="bg-slate-950 rounded-md px-3 py-2 text-xs text-slate-300">
            {summaryText}
          </div>
        )}
      </div>
    );
  }

  // Expanded (active) state
  return (
    <div className="border-2 border-pink-500 rounded-xl p-3.5 bg-pink-500/[0.02]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-pink-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
            {index + 1}
          </span>
          <span className="text-slate-200 text-sm font-semibold">Service</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-500 hover:text-slate-300 text-sm"
        >
          ✕
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0 border-b-2 border-slate-700 mb-0 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryChange(cat.id)}
            className={`
              px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors
              ${cat.id === activeCategoryId
                ? 'text-pink-500 border-b-2 border-pink-500 -mb-[2px] font-semibold'
                : 'text-slate-400 hover:text-slate-200'
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
