import React from 'react';
import type { ServiceVariant } from '../../../types';

interface VariantListProps {
  variants: ServiceVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
}

export default function VariantList({ variants, selectedVariantId, onSelect }: VariantListProps) {
  return (
    <div className="flex flex-col gap-0.5 mt-2">
      {variants.map((v) => {
        const isSelected = v.id === selectedVariantId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-left transition-colors ${
              isSelected
                ? 'bg-slate-950 border border-pink-500'
                : 'bg-slate-950 border border-slate-700 hover:border-slate-500'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-pink-500' : 'border border-slate-600'}`} />
            <span className={`text-[11px] flex-1 ${isSelected ? 'text-slate-200' : 'text-slate-300'}`}>{v.name}</span>
            <span className="text-slate-500 text-[10px]">{v.durationMinutes}m</span>
            <span className={`text-[10px] font-semibold ${isSelected ? 'text-pink-500' : 'text-slate-500'}`}>{v.price}</span>
          </button>
        );
      })}
    </div>
  );
}
