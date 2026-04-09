import React, { useState } from 'react';
import { Check, Star, Package } from 'lucide-react';
import type { Service, ServiceCategory, FavoriteItem, Pack, ServiceBlockItem } from '../../../types';
import { formatPrice, formatDuration } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { getPackDiscount, formatPackItemCount } from '../../services/utils/packExpansion';

interface MobileServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  favorites?: FavoriteItem[];
  packs?: Pack[];
  initialCategoryId: string | null;
  initialItems: ServiceBlockItem[];
  onConfirm: (items: ServiceBlockItem[], categoryId: string | null) => void;
  onPackSelect?: (pack: Pack) => void;
  onClose: () => void;
}

export const MobileServicePicker: React.FC<MobileServicePickerProps> = ({
  services,
  categories,
  favorites = [],
  packs = [],
  initialCategoryId,
  initialItems,
  onConfirm,
  onPackSelect,
  onClose,
}) => {
  const [selectedItems, setSelectedItems] = useState<ServiceBlockItem[]>(initialItems);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => {
    if (initialItems.length > 0) {
      const first = initialItems[0];
      const svc = services.find((s) => s.id === first.serviceId);
      if (svc?.categoryId) return svc.categoryId;
    }
    return favorites.length > 0 ? 'FAVORITES' : initialCategoryId ?? categories[0]?.id ?? null;
  });

  const isLocked = selectedItems.length > 0;

  // When locked, the user is anchored to the category of the first selected item.
  // Compute that category so we can disable sibling pills in the row.
  const lockedCategoryId: string | null = (() => {
    if (!isLocked) return null;
    const firstSvc = services.find((s) => s.id === selectedItems[0].serviceId);
    return firstSvc?.categoryId ?? null;
  })();

  const filteredServices =
    activeCategoryId === 'FAVORITES' || activeCategoryId === 'PACKS' || activeCategoryId === null
      ? []
      : services.filter((s) => s.active && s.categoryId === activeCategoryId);

  const isCategoryPillDisabled = (pillId: string): boolean => {
    if (!isLocked) return false;
    // Favorites stays available as a browsing view only if it matches the locked category scope;
    // for simplicity we keep Favorites enabled only when it was the active tab at lock time.
    if (pillId === activeCategoryId) return false;
    // All other pills (categories + Favorites + Packs) become disabled while locked.
    return true;
  };

  const handleCategoryTap = (categoryId: string) => {
    if (isCategoryPillDisabled(categoryId)) return;
    setActiveCategoryId(categoryId);
  };

  const toggleItem = (serviceId: string, variantId: string) => {
    setSelectedItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.serviceId === serviceId);
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        if (existing.variantId === variantId) {
          // Same variant tapped again → deselect this service
          return prev.filter((_, idx) => idx !== existingIdx);
        }
        // Different variant of already-selected service → replace variantId
        const next = prev.slice();
        next[existingIdx] = { ...existing, variantId };
        return next;
      }
      // New service → append
      return [...prev, { serviceId, variantId }];
    });
  };

  const isServiceSelected = (serviceId: string) =>
    selectedItems.some((i) => i.serviceId === serviceId);

  const getSelectedVariantId = (serviceId: string): string | null =>
    selectedItems.find((i) => i.serviceId === serviceId)?.variantId ?? null;

  const handleClear = () => {
    setSelectedItems([]);
  };

  const handleConfirm = () => {
    let resolvedCategoryId: string | null = null;
    if (selectedItems.length > 0) {
      const firstSvc = services.find((s) => s.id === selectedItems[0].serviceId);
      resolvedCategoryId = firstSvc?.categoryId ?? null;
    }
    onConfirm(selectedItems, resolvedCategoryId);
    onClose();
  };

  const getServiceSubtitle = (service: Service) => {
    const parts: string[] = [];
    if (service.variants.length > 1) {
      parts.push(`${service.variants.length} variantes`);
    }
    const duration = service.durationMinutes ?? service.variants[0]?.durationMinutes;
    if (duration) parts.push(formatDuration(duration));
    const price = service.price ?? service.variants[0]?.price;
    if (price != null) parts.push(formatPrice(price));
    return parts.join(' · ');
  };

  // Render a single regular-service card with toggle + variant expansion
  const renderServiceCard = (service: Service) => {
    const isSelected = isServiceSelected(service.id);
    const selectedVariantId = getSelectedVariantId(service.id);
    const showVariantList = service.variants.length > 1;

    const handleHeaderTap = () => {
      if (service.variants.length === 1) {
        toggleItem(service.id, service.variants[0].id);
        return;
      }
      // Multi-variant: header tap deselects if currently selected; otherwise no-op
      if (isSelected && selectedVariantId) {
        toggleItem(service.id, selectedVariantId);
      }
    };

    return (
      <div key={service.id}>
        <button
          type="button"
          onClick={handleHeaderTap}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl min-h-[52px] transition-colors ${
            isSelected
              ? 'bg-blue-50 border-2 border-blue-400'
              : 'bg-white border border-slate-200'
          }`}
        >
          <div className="text-left">
            <div className="text-sm font-medium text-slate-900">{service.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{getServiceSubtitle(service)}</div>
          </div>
          {isSelected && (
            <Check size={16} className="text-blue-500 shrink-0 ml-2" />
          )}
        </button>

        {showVariantList && (
          <div className="ml-3 mt-2 flex flex-col gap-1.5">
            {service.variants.map((variant) => {
              const variantSelected = selectedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => toggleItem(service.id, variant.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl min-h-[48px] transition-colors ${
                    variantSelected
                      ? 'bg-blue-50 border-2 border-blue-400'
                      : 'bg-white border border-slate-200 active:bg-slate-50'
                  }`}
                >
                  <div className="text-left flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{variant.name}</span>
                    <span className="text-xs text-slate-500">{formatDuration(variant.durationMinutes)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-sm font-semibold text-blue-600">{formatPrice(variant.price)}</span>
                    {variantSelected && <Check size={14} className="text-blue-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render a service-type favorite card (may contain multiple variants)
  const renderFavoriteServiceCard = (service: Service) => {
    const isSelected = isServiceSelected(service.id);
    const selectedVariantId = getSelectedVariantId(service.id);
    const showVariantList = service.variants.length > 1;

    const handleHeaderTap = () => {
      if (service.variants.length === 1) {
        toggleItem(service.id, service.variants[0].id);
        return;
      }
      if (isSelected && selectedVariantId) {
        toggleItem(service.id, selectedVariantId);
      }
    };

    return (
      <div key={`fav-svc-${service.id}`}>
        <button
          type="button"
          onClick={handleHeaderTap}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl min-h-[52px] transition-colors ${
            isSelected
              ? 'bg-blue-50 border-2 border-blue-400'
              : 'bg-white border border-slate-200'
          }`}
        >
          <div className="text-left">
            <div className="text-sm font-medium text-slate-900">{service.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{getServiceSubtitle(service)}</div>
          </div>
          {isSelected && <Check size={16} className="text-blue-500 shrink-0 ml-2" />}
        </button>

        {showVariantList && (
          <div className="ml-3 mt-2 flex flex-col gap-1.5">
            {service.variants.map((variant) => {
              const variantSelected = selectedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => toggleItem(service.id, variant.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl min-h-[48px] transition-colors ${
                    variantSelected
                      ? 'bg-blue-50 border-2 border-blue-400'
                      : 'bg-white border border-slate-200 active:bg-slate-50'
                  }`}
                >
                  <div className="text-left flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{variant.name}</span>
                    <span className="text-xs text-slate-500">{formatDuration(variant.durationMinutes)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-sm font-semibold text-blue-600">{formatPrice(variant.price)}</span>
                    {variantSelected && <Check size={14} className="text-blue-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render a variant-type favorite (single-tap to toggle a specific variant)
  const renderFavoriteVariantCard = (parentService: Service, variant: Service['variants'][number]) => {
    const selected = getSelectedVariantId(parentService.id) === variant.id;
    return (
      <button
        key={`fav-var-${variant.id}`}
        type="button"
        onClick={() => toggleItem(parentService.id, variant.id)}
        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl min-h-[52px] transition-colors ${
          selected
            ? 'bg-blue-50 border-2 border-blue-400'
            : 'bg-white border border-slate-200 active:bg-slate-50'
        }`}
      >
        <div className="text-left">
          <div className="text-sm font-medium text-slate-900">
            {parentService.name} — {variant.name}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {formatDuration(variant.durationMinutes)} · {formatPrice(variant.price)}
          </div>
        </div>
        {selected && <Check size={16} className="text-blue-500 shrink-0 ml-2" />}
      </button>
    );
  };

  const pillBaseClass = 'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors';
  const pillDisabledClass = 'opacity-40';

  return (
    <div className="flex flex-col min-h-full">
      {/* Category pill row */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-5 px-5 scrollbar-hide">
        {favorites.length > 0 && (
          <button
            type="button"
            disabled={isCategoryPillDisabled('FAVORITES')}
            aria-disabled={isCategoryPillDisabled('FAVORITES')}
            onClick={() => handleCategoryTap('FAVORITES')}
            className={`${pillBaseClass} ${
              activeCategoryId === 'FAVORITES'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600'
            } ${isCategoryPillDisabled('FAVORITES') ? pillDisabledClass : ''}`}
          >
            <Star size={14} className={activeCategoryId === 'FAVORITES' ? 'text-white fill-white' : 'text-slate-500'} />
            Favoris
          </button>
        )}
        {packs.length > 0 && !isLocked && (
          <button
            type="button"
            onClick={() => handleCategoryTap('PACKS')}
            className={`${pillBaseClass} ${
              activeCategoryId === 'PACKS'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Package size={14} className={activeCategoryId === 'PACKS' ? 'text-white' : 'text-slate-500'} />
            Packs
          </button>
        )}
        {categories.map((cat) => {
          const disabled = isCategoryPillDisabled(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => handleCategoryTap(cat.id)}
              className={`${pillBaseClass} ${
                activeCategoryId === cat.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600'
              } ${disabled ? pillDisabledClass : ''}`}
            >
              <CategoryIcon
                categoryName={cat.name}
                iconName={cat.icon}
                size={14}
                className={activeCategoryId === cat.id ? 'text-white' : 'text-slate-500'}
              />
              {cat.name}
            </button>
          );
        })}
        {isLocked && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 rounded-full text-xs font-medium text-slate-500 border border-slate-200 bg-white shrink-0 min-h-[36px]"
          >
            Vider
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 pb-4">
        {/* Packs list */}
        {activeCategoryId === 'PACKS' && (
          <div className="flex flex-col gap-2">
            {packs.map((pack) => {
              const discount = getPackDiscount(pack);
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => {
                    onPackSelect?.(pack);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border border-slate-200 min-h-[52px] transition-colors active:bg-emerald-50"
                >
                  <div className="text-left">
                    <div className="text-sm font-medium text-slate-900">{pack.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatPackItemCount(pack)}
                      {discount > 0 && ` · -${discount}%`}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 shrink-0 ml-2">
                    {formatPrice(pack.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Favorites list */}
        {activeCategoryId === 'FAVORITES' && (
          <div className="flex flex-col gap-2">
            {favorites.map((fav) => {
              if (fav.type === 'pack') {
                if (isLocked) return null; // hide pack favorites while locked
                const pack = fav.pack;
                const discount = getPackDiscount(pack);
                return (
                  <button
                    key={`fav-pack-${pack.id}`}
                    type="button"
                    onClick={() => {
                      onPackSelect?.(pack);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border border-slate-200 min-h-[52px] transition-colors active:bg-emerald-50"
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium text-slate-900">{pack.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatPackItemCount(pack)}
                        {discount > 0 && ` · -${discount}%`}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 shrink-0 ml-2">
                      {formatPrice(pack.price)}
                    </span>
                  </button>
                );
              }
              if (fav.type === 'service') {
                // When locked, only show favorites whose category matches the lock
                if (isLocked && lockedCategoryId && fav.service.categoryId !== lockedCategoryId) {
                  return null;
                }
                return renderFavoriteServiceCard(fav.service);
              }
              // Variant-type favorite
              if (isLocked && lockedCategoryId && fav.parentService.categoryId !== lockedCategoryId) {
                return null;
              }
              return renderFavoriteVariantCard(fav.parentService, fav.variant);
            })}
          </div>
        )}

        {/* Regular service list */}
        {activeCategoryId !== 'FAVORITES' && activeCategoryId !== 'PACKS' && (
          <div className="flex flex-col gap-2">
            {filteredServices.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">
                Aucun service dans cette catégorie
              </p>
            )}
            {filteredServices.map(renderServiceCard)}
          </div>
        )}
      </div>

      {/* Sticky confirm bar */}
      <div
        className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 -mx-5"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          disabled={selectedItems.length === 0}
          onClick={handleConfirm}
          className="w-full bg-blue-500 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          Valider ({selectedItems.length})
        </button>
      </div>
    </div>
  );
};
