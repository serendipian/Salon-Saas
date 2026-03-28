import React from 'react';
import type { Service } from '../../../types';
import VariantList from './VariantList';

interface ServiceGridProps {
  services: Service[];
  selectedServiceId: string | null;
  selectedVariantId: string | null;
  onSelectService: (serviceId: string) => void;
  onSelectVariant: (variantId: string) => void;
}

export default function ServiceGrid({
  services,
  selectedServiceId,
  selectedVariantId,
  onSelectService,
  onSelectVariant,
}: ServiceGridProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 border-t-0 rounded-b-lg p-1.5">
      <div className="grid grid-cols-3 max-md:grid-cols-2 gap-1.5">
        {services.map((svc) => {
          const isSelected = svc.id === selectedServiceId;
          return (
            <div
              key={svc.id}
              className={`rounded-lg p-2.5 transition-colors ${
                isSelected
                  ? 'bg-white border-2 border-pink-400'
                  : 'bg-white border border-slate-200 cursor-pointer hover:border-slate-400'
              }`}
              onClick={() => !isSelected && onSelectService(svc.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && !isSelected && onSelectService(svc.id)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-semibold ${isSelected ? 'text-slate-800' : 'text-slate-700'}`}>{svc.name}</span>
                {isSelected && (
                  <span className="w-4 h-4 bg-pink-400 rounded text-[9px] text-white flex items-center justify-center">✓</span>
                )}
              </div>
              {isSelected ? (
                <VariantList variants={svc.variants} selectedVariantId={selectedVariantId} onSelect={onSelectVariant} />
              ) : (
                <span className="text-slate-400 text-[10px]">
                  {svc.variants.length} variante{svc.variants.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
