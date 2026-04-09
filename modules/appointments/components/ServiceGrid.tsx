import React, { useMemo } from 'react';
import type { Service, ServiceCategory, FavoriteItem } from '../../../types';
import VariantList from './VariantList';
import { Check } from 'lucide-react';

interface ServiceGridProps {
  services: Service[];
  favorites?: FavoriteItem[];
  categories?: ServiceCategory[];
  selectedServiceId: string | null;
  selectedVariantId: string | null;
  onSelectService: (serviceId: string) => void;
  onSelectVariant: (variantId: string, serviceId?: string) => void;
}

export default function ServiceGrid({
  services,
  favorites = [],
  categories = [],
  selectedServiceId,
  selectedVariantId,
  onSelectService,
  onSelectVariant,
}: ServiceGridProps) {
  const showFavorites = favorites.length > 0;

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  return (
    <div className="bg-white/60 border border-slate-200 rounded-xl p-2">
      {/* Favorites grid */}
      {showFavorites && (
        <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2 mb-2">
          {favorites.map((fav) => {
            if (fav.type === 'service') {
              const svc = fav.service;
              const isSingleVariant = svc.variants.length === 1;
              const variant = svc.variants[0];
              const catName = categoryMap.get(svc.categoryId);
              const isSelected = isSingleVariant
                ? selectedVariantId === variant?.id
                : svc.id === selectedServiceId;

              // Single-variant service: render as flat card matching variant favorite layout
              if (isSingleVariant && variant) {
                return (
                  <div
                    key={`fav-svc-${svc.id}`}
                    className={`rounded-xl p-3 transition-all ${
                      isSelected
                        ? 'bg-white border-2 border-blue-400 shadow-sm'
                        : 'bg-white border border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-sm'
                    }`}
                    onClick={() => !isSelected && onSelectVariant(variant.id, svc.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && !isSelected && onSelectVariant(variant.id, svc.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        {catName && <><span className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{catName}</span><span className="text-xs text-slate-500"> — </span></>}
                        <span className={`text-xs ${catName ? 'text-slate-500' : `font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}`}>{svc.name}</span>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                          <Check size={12} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Multi-variant service: expandable card
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
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      {catName && <span className="text-[11px] text-slate-400">{catName}</span>}
                      <div className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{svc.name}</div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm shrink-0 ml-1">
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  {isSelected ? (
                    <VariantList variants={svc.variants} selectedVariantId={selectedVariantId} onSelect={(vid) => onSelectVariant(vid, svc.id)} />
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      {svc.variants.length} variantes
                    </span>
                  )}
                </div>
              );
            } else if (fav.type === 'variant') {
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
                    {isSelected && (
                      <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                    )}
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
