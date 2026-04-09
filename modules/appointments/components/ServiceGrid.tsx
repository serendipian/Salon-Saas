import React from 'react';
import type { Service, FavoriteItem } from '../../../types';
import VariantList from './VariantList';
import { Check } from 'lucide-react';
import { formatPrice, formatDuration } from '../../../lib/format';

interface ServiceGridProps {
  services: Service[];
  favorites?: FavoriteItem[];
  selectedServiceId: string | null;
  selectedVariantId: string | null;
  onSelectService: (serviceId: string) => void;
  onSelectVariant: (variantId: string, serviceId?: string) => void;
}

export default function ServiceGrid({
  services,
  favorites = [],
  selectedServiceId,
  selectedVariantId,
  onSelectService,
  onSelectVariant,
}: ServiceGridProps) {
  const showFavorites = favorites.length > 0;

  return (
    <div className="bg-white/60 border border-slate-200 border-t-0 rounded-b-xl p-2">
      {/* Favorites list */}
      {showFavorites && (
        <div className="space-y-1.5 mb-2">
          {favorites.map((fav) => {
            if (fav.type === 'service') {
              const svc = fav.service;
              const isSelected = svc.id === selectedServiceId;
              return (
                <div
                  key={`fav-svc-${svc.id}`}
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
                    <VariantList variants={svc.variants} selectedVariantId={selectedVariantId} onSelect={(vid) => onSelectVariant(vid, svc.id)} />
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      {svc.variants.length} variante{svc.variants.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              );
            } else {
              // Variant-type favorite — standalone card, selects directly
              const { variant, parentService } = fav;
              const isSelected = selectedVariantId === variant.id;
              return (
                <div
                  key={`fav-var-${variant.id}`}
                  className={`rounded-xl p-3 transition-all ${
                    isSelected
                      ? 'bg-white border-2 border-blue-400 shadow-sm'
                      : 'bg-white border border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-sm'
                  }`}
                  onClick={() => !isSelected && onSelectVariant(variant.id, parentService.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && !isSelected && onSelectVariant(variant.id, parentService.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{parentService.name}</span>
                      <span className="text-xs text-slate-500"> — {variant.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">{formatDuration(variant.durationMinutes)} — {formatPrice(variant.price)}</span>
                      {isSelected && (
                        <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                          <Check size={12} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* Regular services grid */}
      {services.length > 0 && (
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
      )}
    </div>
  );
}
