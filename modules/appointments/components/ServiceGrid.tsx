import React from 'react';
import type { Service } from '../../../types';
import VariantList from './VariantList';
import { Check } from 'lucide-react';

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
    <div className="bg-white/60 border border-slate-200 border-t-0 rounded-b-xl p-2">
      <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
        {services.map((svc) => {
          const isSelected = svc.id === selectedServiceId;
          return (
            <div
              key={svc.id}
              className={`rounded-xl p-3 transition-all ${
                isSelected
                  ? 'bg-white border-2 border-blue-400 shadow-sm'
                  : 'bg-white border border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-sm'
              }`}
              onClick={() => !isSelected && onSelectService(svc.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && !isSelected && onSelectService(svc.id)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{svc.name}</span>
                {isSelected && (
                  <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
              </div>
              {isSelected ? (
                <VariantList variants={svc.variants} selectedVariantId={selectedVariantId} onSelect={onSelectVariant} />
              ) : (
                <span className="text-slate-400 text-[11px]">
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
