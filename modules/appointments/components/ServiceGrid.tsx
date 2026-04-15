import { Check, Gift } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { formatDuration, formatPrice } from '../../../lib/format';
import type {
  FavoriteItem,
  Pack,
  Service,
  ServiceBlockItem,
  ServiceCategory,
} from '../../../types';
import { formatPackItemCount, getPackDiscount } from '../../services/utils/packExpansion';
import VariantList from './VariantList';

interface ServiceGridProps {
  services: Service[];
  favorites?: FavoriteItem[];
  categories?: ServiceCategory[];
  selectedItems: ServiceBlockItem[];
  onToggleItem: (serviceId: string, variantId: string) => void;
  onAddPackBlocks?: (pack: Pack) => void;
  activePackId?: string | null;
  /**
   * When the parent block is locked to a single category (because it already
   * contains items), favorites whose category does not match are rendered
   * disabled. `null` = no lock.
   */
  lockedCategoryId?: string | null;
}

export default function ServiceGrid({
  services,
  favorites = [],
  categories = [],
  selectedItems,
  onToggleItem,
  onAddPackBlocks,
  activePackId = null,
  lockedCategoryId = null,
}: ServiceGridProps) {
  const showFavorites = favorites.length > 0;
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, ServiceCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const getSelectedVariantIdForService = (serviceId: string): string | null => {
    return selectedItems.find((i) => i.serviceId === serviceId)?.variantId ?? null;
  };

  const isServiceSelected = (serviceId: string): boolean => {
    return selectedItems.some((i) => i.serviceId === serviceId);
  };

  const isPackItem = (serviceId: string): boolean => {
    return selectedItems.some((i) => i.serviceId === serviceId && i.priceOverride != null);
  };

  return (
    <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
      {/* Favorites */}
      {showFavorites &&
        favorites.map((fav) => {
          if (fav.type === 'service') {
            const svc = fav.service;
            const isSingleVariant = svc.variants.length === 1;
            const variant = svc.variants[0];
            const cat = categoryMap.get(svc.categoryId);
            const isLocked = isPackItem(svc.id);
            const isDisabledByLock =
              lockedCategoryId !== null && svc.categoryId !== lockedCategoryId;
            const isDisabled = isDisabledByLock || isLocked;
            const disabledClass = isDisabledByLock
              ? 'opacity-40 cursor-not-allowed pointer-events-none'
              : '';

            if (isSingleVariant && variant) {
              const isSelected =
                isServiceSelected(svc.id) && getSelectedVariantIdForService(svc.id) === variant.id;
              return (
                <div
                  key={`fav-svc-${svc.id}`}
                  aria-disabled={isDisabled}
                  className={`rounded-lg p-3 transition-all ${isLocked ? 'cursor-default' : 'cursor-pointer'} ${
                    isSelected
                      ? isLocked
                        ? 'bg-blue-50/60 border-2 border-blue-300 opacity-60'
                        : 'bg-blue-50 border-2 border-blue-400 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                  } ${disabledClass}`}
                  onClick={() => {
                    if (!isDisabled) onToggleItem(svc.id, variant.id);
                  }}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  onKeyDown={(e) => {
                    if (!isDisabled && e.key === 'Enter') onToggleItem(svc.id, variant.id);
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {cat && (
                      <CategoryIcon
                        categoryName={cat.name}
                        iconName={cat.icon}
                        size={12}
                        className="text-slate-400 shrink-0"
                      />
                    )}
                    <span className="text-sm font-medium text-slate-900 truncate flex-1">
                      {svc.name}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm shrink-0">
                        <Check size={10} strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    {variant.durationMinutes > 0 && (
                      <span>{formatDuration(variant.durationMinutes)}</span>
                    )}
                    {variant.durationMinutes > 0 && <span className="text-slate-300">·</span>}
                    <span className="font-semibold text-slate-700">
                      {formatPrice(variant.price)}
                    </span>
                  </div>
                </div>
              );
            }

            // Multi-variant service
            const isSelected = isServiceSelected(svc.id);
            const selectedVariantId = getSelectedVariantIdForService(svc.id);
            const isExpanded = expandedServiceId === svc.id;
            return (
              <div
                key={`fav-svc-${svc.id}`}
                aria-disabled={isDisabled}
                className={`rounded-lg p-3 transition-all ${isLocked ? 'cursor-default' : 'cursor-pointer'} ${
                  isSelected
                    ? isLocked
                      ? 'bg-blue-50/60 border-2 border-blue-300 opacity-60'
                      : 'bg-blue-50 border-2 border-blue-400 shadow-sm'
                    : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                } ${disabledClass}`}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                onClick={() => {
                  if (isDisabled) return;
                  if (isSelected && selectedVariantId) {
                    onToggleItem(svc.id, selectedVariantId);
                    setExpandedServiceId(null);
                  } else {
                    setExpandedServiceId(isExpanded ? null : svc.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (isDisabled || e.key !== 'Enter') return;
                  if (isSelected && selectedVariantId) {
                    onToggleItem(svc.id, selectedVariantId);
                    setExpandedServiceId(null);
                  } else {
                    setExpandedServiceId(isExpanded ? null : svc.id);
                  }
                }}
              >
                <div className="flex items-center gap-1.5">
                  {cat && (
                    <CategoryIcon
                      categoryName={cat.name}
                      iconName={cat.icon}
                      size={12}
                      className="text-slate-400 shrink-0"
                    />
                  )}
                  <span className="text-sm font-medium text-slate-900 truncate flex-1">
                    {svc.name}
                  </span>
                  <span className="text-xs text-slate-400">{svc.variants.length} var.</span>
                  {isSelected && (
                    <span className="w-4 h-4 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm shrink-0">
                      <Check size={10} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                {isExpanded && (
                  <VariantList
                    variants={svc.variants}
                    selectedVariantId={selectedVariantId}
                    onSelect={(vid) => {
                      if (!isDisabled) {
                        onToggleItem(svc.id, vid);
                        setExpandedServiceId(null);
                      }
                    }}
                  />
                )}
              </div>
            );
          } else if (fav.type === 'pack') {
            const { pack } = fav;
            const discount = getPackDiscount(pack);
            const isSelected = activePackId === pack.id;
            // Pack favorites stay clickable when their own pack is selected (to toggle off)
            // but are disabled when non-pack services are already in the block.
            const isDisabledByLock = lockedCategoryId !== null && !isSelected;
            const disabledClass = isDisabledByLock
              ? 'opacity-40 cursor-not-allowed pointer-events-none'
              : '';
            return (
              <div
                key={`fav-pack-${pack.id}`}
                aria-disabled={isDisabledByLock}
                className={`rounded-lg p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 border-2 border-emerald-400 shadow-sm'
                    : 'bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                } ${disabledClass}`}
                onClick={() => {
                  if (!isDisabledByLock) onAddPackBlocks?.(pack);
                }}
                role="button"
                tabIndex={isDisabledByLock ? -1 : 0}
                onKeyDown={(e) => {
                  if (!isDisabledByLock && e.key === 'Enter') onAddPackBlocks?.(pack);
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Gift size={12} className="text-emerald-600" />
                  <span className="text-sm font-medium text-slate-900 truncate">{pack.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{formatPackItemCount(pack)}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-semibold text-slate-700">{formatPrice(pack.price)}</span>
                  {discount > 0 && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      -{discount}%
                    </span>
                  )}
                </div>
              </div>
            );
          } else if (fav.type === 'variant') {
            const { variant, parentService } = fav;
            const cat = categoryMap.get(parentService.categoryId);
            const isSelected = selectedItems.some(
              (i) => i.serviceId === parentService.id && i.variantId === variant.id,
            );
            const isLockedByPack = isPackItem(parentService.id);
            const isDisabledByLock =
              lockedCategoryId !== null && parentService.categoryId !== lockedCategoryId;
            const isDisabled = isDisabledByLock || isLockedByPack;
            const disabledClass = isDisabledByLock
              ? 'opacity-40 cursor-not-allowed pointer-events-none'
              : '';
            return (
              <div
                key={`fav-var-${variant.id}`}
                aria-disabled={isDisabled}
                className={`rounded-lg p-3 transition-all ${isLockedByPack ? 'cursor-default' : 'cursor-pointer'} ${
                  isSelected
                    ? isLockedByPack
                      ? 'bg-blue-50/60 border-2 border-blue-300 opacity-60'
                      : 'bg-blue-50 border-2 border-blue-400 shadow-sm'
                    : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                } ${disabledClass}`}
                onClick={() => {
                  if (!isDisabled) onToggleItem(parentService.id, variant.id);
                }}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                onKeyDown={(e) => {
                  if (!isDisabled && e.key === 'Enter') onToggleItem(parentService.id, variant.id);
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {cat && (
                    <CategoryIcon
                      categoryName={cat.name}
                      iconName={cat.icon}
                      size={12}
                      className="text-slate-400 shrink-0"
                    />
                  )}
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {parentService.name}
                  </span>
                  <span className="text-sm text-slate-400 truncate">— {variant.name}</span>
                  {isSelected && (
                    <span className="w-4 h-4 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm shrink-0 ml-auto">
                      <Check size={10} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  {variant.durationMinutes > 0 && (
                    <span>{formatDuration(variant.durationMinutes)}</span>
                  )}
                  {variant.durationMinutes > 0 && <span className="text-slate-300">·</span>}
                  <span className="font-semibold text-slate-700">{formatPrice(variant.price)}</span>
                </div>
              </div>
            );
          }
        })}

      {/* Regular services */}
      {services.map((svc) => {
        const isSelected = isServiceSelected(svc.id);
        const selectedVariantId = getSelectedVariantIdForService(svc.id);
        const isSingleVariant = svc.variants.length === 1;
        const singleVariant = svc.variants[0];
        const isLocked = isPackItem(svc.id);

        if (isSingleVariant && singleVariant) {
          return (
            <div
              key={svc.id}
              className={`rounded-lg p-3 transition-all ${isLocked ? 'cursor-default' : 'cursor-pointer'} ${
                isSelected
                  ? isLocked
                    ? 'bg-blue-50/60 border-2 border-blue-300 opacity-60'
                    : 'bg-blue-50 border-2 border-blue-400 shadow-sm'
                  : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
              onClick={() => {
                if (!isLocked) onToggleItem(svc.id, singleVariant.id);
              }}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              onKeyDown={(e) => {
                if (!isLocked && e.key === 'Enter') onToggleItem(svc.id, singleVariant.id);
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm font-medium text-slate-900 truncate flex-1">
                  {svc.name}
                </span>
                {isSelected && (
                  <span className="w-4 h-4 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm shrink-0">
                    <Check size={10} strokeWidth={2.5} />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                {singleVariant.durationMinutes > 0 && (
                  <span>{formatDuration(singleVariant.durationMinutes)}</span>
                )}
                {singleVariant.durationMinutes > 0 && <span className="text-slate-300">·</span>}
                <span className="font-semibold text-slate-700">
                  {formatPrice(singleVariant.price)}
                </span>
              </div>
            </div>
          );
        }

        // Multi-variant
        const isExpanded = expandedServiceId === svc.id;
        return (
          <div
            key={svc.id}
            className={`rounded-lg p-3 transition-all ${isLocked ? 'cursor-default' : 'cursor-pointer'} ${
              isSelected
                ? isLocked
                  ? 'bg-blue-50/60 border-2 border-blue-300 opacity-60'
                  : 'bg-blue-50 border-2 border-blue-400 shadow-sm'
                : 'bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
            role="button"
            tabIndex={isLocked ? -1 : 0}
            onClick={() => {
              if (isLocked) return;
              if (isSelected && selectedVariantId) {
                onToggleItem(svc.id, selectedVariantId);
                setExpandedServiceId(null);
              } else {
                setExpandedServiceId(isExpanded ? null : svc.id);
              }
            }}
            onKeyDown={(e) => {
              if (isLocked || e.key !== 'Enter') return;
              if (isSelected && selectedVariantId) {
                onToggleItem(svc.id, selectedVariantId);
                setExpandedServiceId(null);
              } else {
                setExpandedServiceId(isExpanded ? null : svc.id);
              }
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-slate-900 truncate flex-1">{svc.name}</span>
              <span className="text-xs text-slate-400">{svc.variants.length} var.</span>
              {isSelected && (
                <span className="w-4 h-4 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center shadow-sm shrink-0">
                  <Check size={10} strokeWidth={2.5} />
                </span>
              )}
            </div>
            {isExpanded && (
              <VariantList
                variants={svc.variants}
                selectedVariantId={selectedVariantId}
                onSelect={(vid) => {
                  onToggleItem(svc.id, vid);
                  setExpandedServiceId(null);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
