import React, { useMemo } from 'react';
import type { Service, ServiceCategory, FavoriteItem, ServiceBlockItem } from '../../../types';
import VariantList from './VariantList';
import { Check } from 'lucide-react';

interface ServiceGridProps {
  services: Service[];
  favorites?: FavoriteItem[];
  categories?: ServiceCategory[];
  selectedItems: ServiceBlockItem[];
  onToggleItem: (serviceId: string, variantId: string) => void;
}

export default function ServiceGrid({
  services,
  favorites = [],
  categories = [],
  selectedItems,
  onToggleItem,
}: ServiceGridProps) {
  const showFavorites = favorites.length > 0;

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const getSelectedVariantIdForService = (serviceId: string): string | null => {
    return selectedItems.find((i) => i.serviceId === serviceId)?.variantId ?? null;
  };

  const isServiceSelected = (serviceId: string): boolean => {
    return selectedItems.some((i) => i.serviceId === serviceId);
  };

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

              // Single-variant service: render as flat card matching variant favorite layout
              if (isSingleVariant && variant) {
                const isSelected = isServiceSelected(svc.id) && getSelectedVariantIdForService(svc.id) === variant.id;
                return (
                  <div
                    key={`fav-svc-${svc.id}`}
                    className={`rounded-xl p-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-2 border-blue-400 shadow-sm'
                        : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                    onClick={() => onToggleItem(svc.id, variant.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onToggleItem(svc.id, variant.id)}
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

              // Multi-variant service: expandable card with always-visible variant list
              const isSelected = isServiceSelected(svc.id);
              const selectedVariantId = getSelectedVariantIdForService(svc.id);
              return (
                <div
                  key={`fav-svc-${svc.id}`}
                  className={`rounded-xl p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-blue-400 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="flex justify-between items-start"
                    onClick={() => {
                      if (isSelected && selectedVariantId) {
                        // Click card header of selected multi-variant service → deselect
                        onToggleItem(svc.id, selectedVariantId);
                      }
                      // Otherwise, do nothing on header click — user picks a variant below
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isSelected && selectedVariantId) {
                        onToggleItem(svc.id, selectedVariantId);
                      }
                    }}
                  >
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
                  {/* Variant list always shown for multi-variant services */}
                  <VariantList
                    variants={svc.variants}
                    selectedVariantId={selectedVariantId}
                    onSelect={(vid) => onToggleItem(svc.id, vid)}
                  />
                </div>
              );
            } else if (fav.type === 'variant') {
              // Variant-type favorite — standalone card, selects directly
              const { variant, parentService } = fav;
              const isSelected = selectedItems.some(
                (i) => i.serviceId === parentService.id && i.variantId === variant.id,
              );
              return (
                <div
                  key={`fav-var-${variant.id}`}
                  className={`rounded-xl p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-blue-400 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                  onClick={() => onToggleItem(parentService.id, variant.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onToggleItem(parentService.id, variant.id)}
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
            const isSelected = isServiceSelected(svc.id);
            const selectedVariantId = getSelectedVariantIdForService(svc.id);
            const isSingleVariant = svc.variants.length === 1;
            const singleVariant = svc.variants[0];

            return (
              <div
                key={svc.id}
                className={`rounded-xl p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-2 border-blue-400 shadow-sm'
                    : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm'
                }`}
                onClick={() => {
                  if (isSingleVariant && singleVariant) {
                    onToggleItem(svc.id, singleVariant.id);
                  } else if (isSelected && selectedVariantId) {
                    // Header click on selected multi-variant → deselect
                    onToggleItem(svc.id, selectedVariantId);
                  }
                  // Otherwise do nothing; user picks a variant below
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (isSingleVariant && singleVariant) {
                    onToggleItem(svc.id, singleVariant.id);
                  } else if (isSelected && selectedVariantId) {
                    onToggleItem(svc.id, selectedVariantId);
                  }
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{svc.name}</span>
                  {isSelected && (
                    <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm">
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                {!isSingleVariant && (
                  <VariantList
                    variants={svc.variants}
                    selectedVariantId={selectedVariantId}
                    onSelect={(vid) => onToggleItem(svc.id, vid)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
