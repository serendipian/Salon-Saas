import React from 'react';
import type { ServiceVariant } from '../../../types';
import { formatPrice } from '../../../lib/format';

interface VariantListProps {
  variants: ServiceVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
}

export default function VariantList({ variants, selectedVariantId, onSelect }: VariantListProps) {
  return (
    <div className="flex flex-col gap-1 mt-2">
      {variants.map((v) => {
        const isSelected = v.id === selectedVariantId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
              isSelected
                ? 'bg-blue-50 border border-blue-300'
                : 'bg-slate-50 border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
            }`}
          >
            <span className={`w-3 h-3 rounded-full flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-500 shadow-sm' : 'border-2 border-slate-300'}`} />
            <span className={`text-[11px] flex-1 ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>{v.name}</span>
            <span className="text-slate-400 text-[10px]">{v.durationMinutes}m</span>
            <span className={`text-[10px] font-semibold ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{formatPrice(v.price)}</span>
          </button>
        );
      })}
    </div>
  );
}
