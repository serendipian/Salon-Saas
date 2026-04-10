import React, { useMemo, useState } from 'react';
import type { Service, ServiceCategory, FavoriteItem, Pack } from '../../../types';
import type { ServiceBlockState } from '../../../types';
import { formatPrice, formatDuration } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { getPackDiscount, formatPackItemCount } from '../../services/utils/packExpansion';
import ServiceGrid from './ServiceGrid';
import { X, Clock, Calendar, Star, Package } from 'lucide-react';

interface ServiceBlockProps {
  block: ServiceBlockState;
  index: number;
  isActive: boolean;
  services: Service[];
  categories: ServiceCategory[];
  favorites: FavoriteItem[];
  onActivate: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<ServiceBlockState>) => void;
  onToggleItem: (serviceId: string, variantId: string) => void;
  onClearItems: () => void;
  summaryText?: string;
  packs?: Pack[];
  onAddPackBlocks?: (pack: Pack) => void;
  stepOffset?: number;
}

export default function ServiceBlock({
  block,
  index,
  isActive,
  services,
  categories,
  favorites,
  onActivate,
  onRemove,
  onUpdate,
  onToggleItem,
  onClearItems,
  summaryText,
  packs = [],
  onAddPackBlocks,
  stepOffset = 0,
}: ServiceBlockProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(() => {
    // Pack-derived block → keep the user on the Packs tab so the selected pack is visible.
    if (block.packId) return 'PACKS';
    // Otherwise, if the block already has items, open the tab matching the first item's category.
    if (block.items.length > 0) {
      const firstItem = block.items[0];
      const svc = services.find((s) => s.id === firstItem.serviceId);
      if (svc?.categoryId) return svc.categoryId;
    }
    if (block.categoryId) return block.categoryId;
    if (favorites.length > 0) return 'FAVORITES';
    return categories[0]?.id || '';
  });

  const filteredServices = useMemo(
    () =>
      activeCategoryId === 'FAVORITES'
        ? []
        : services.filter((s) => s.categoryId === activeCategoryId && s.active),
    [services, activeCategoryId],
  );

  // Two kinds of lock:
  //  - Pack lock: block is part of a pack → only the Packs tab is usable.
  //  - Category lock: block has services from one category → only that category
  //    (and Favoris for browsing) is usable.
  const isPackLocked = !!block.packId;
  const isCategoryLocked = block.items.length > 0 && !block.packId;
  const isLocked = isPackLocked || isCategoryLocked;

  // The category the block is anchored to (derived from first item's service).
  const lockedCategoryId = useMemo<string | null>(() => {
    if (!isCategoryLocked) return null;
    const firstSvc = services.find((s) => s.id === block.items[0].serviceId);
    return firstSvc?.categoryId ?? null;
  }, [isCategoryLocked, block.items, services]);

  // Which pills are still clickable while a lock is active.
  const isPillAllowedWhenLocked = (pillId: string): boolean => {
    if (isPackLocked) return pillId === 'PACKS';
    if (!isCategoryLocked) return true;
    // L-11: only enable Favoris when there's actually something to show.
    // Otherwise tapping it lands on an empty grid which is confusing.
    if (pillId === 'FAVORITES') return favorites.length > 0;
    if (pillId === 'PACKS') return false;
    return pillId === lockedCategoryId;
  };

  const handleCategoryChange = (categoryId: string) => {
    if (!isPillAllowedWhenLocked(categoryId)) return;
    setActiveCategoryId(categoryId);
    onUpdate({ categoryId: categoryId === 'FAVORITES' || categoryId === 'PACKS' ? null : categoryId });
  };

  const handleClear = () => {
    // Pack-locked: toggle the current pack off. addPackBlocks preserves this
    // block's ID on toggle-off so the user stays on the Packs tab.
    if (isPackLocked && block.packId && onAddPackBlocks) {
      const currentPack = packs.find((p) => p.id === block.packId);
      if (currentPack) {
        onAddPackBlocks(currentPack);
        return;
      }
    }
    onClearItems();
  };

  // Block totals (multi-item aware)
  const blockDuration = useMemo(
    () =>
      block.items.reduce((sum, item) => {
        const svc = services.find((s) => s.id === item.serviceId);
        const variant = svc?.variants.find((v) => v.id === item.variantId);
        return sum + (variant?.durationMinutes ?? svc?.durationMinutes ?? 0);
      }, 0),
    [block.items, services],
  );

  const blockPrice = useMemo(
    () =>
      block.items.reduce((sum, item) => {
        const svc = services.find((s) => s.id === item.serviceId);
        const variant = svc?.variants.find((v) => v.id === item.variantId);
        return sum + (item.priceOverride ?? variant?.price ?? svc?.price ?? 0);
      }, 0),
    [block.items, services],
  );

  const firstItemService = useMemo(() => {
    if (block.items.length === 0) return null;
    return services.find((s) => s.id === block.items[0].serviceId) ?? null;
  }, [block.items, services]);

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const formatBlockDate = (dateStr: string) => dateFmt.format(new Date(dateStr + 'T00:00:00'));

  const timeRange = useMemo(() => {
    if (block.hour === null || blockDuration === 0) return null;
    const start = `${block.hour}h${String(block.minute).padStart(2, '0')}`;
    const endTotal = block.hour * 60 + block.minute + blockDuration;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    return `${start} – ${endH}h${String(endM).padStart(2, '0')}`;
  }, [block.hour, block.minute, blockDuration]);

  const headerTitle =
    block.items.length === 0
      ? 'Service'
      : block.items.length === 1
        ? firstItemService?.name ?? 'Service'
        : `${block.items.length} prestations`;

  const serviceInfoBadge = block.items.length > 0 ? (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      {blockDuration > 0 && (
        <span className="flex items-center gap-0.5">
          <Clock size={10} /> {formatDuration(blockDuration)}
        </span>
      )}
      {blockPrice > 0 && <span className="text-blue-600 font-semibold">{formatPrice(blockPrice)}</span>}
      {block.date && (
        <span className="flex items-center gap-0.5">
          <Calendar size={10} /> {formatBlockDate(block.date)}
        </span>
      )}
      {timeRange && <span>{timeRange}</span>}
    </div>
  ) : null;

  // Collapsed (inactive) state
  if (!isActive) {
    return (
      <div
        className="border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all bg-white"
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onActivate()}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {index + 1 + stepOffset}
            </span>
            <span className="text-slate-700 text-sm font-medium">{headerTitle}</span>
            {serviceInfoBadge}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Supprimer ce service"
          >
            <X size={14} className="text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded (active) state
  return (
    <div className="border-2 border-blue-400 rounded-2xl p-4 bg-blue-50/30 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
            {index + 1 + stepOffset}
          </span>
          <span className="text-slate-900 text-sm font-semibold">{headerTitle}</span>
          {serviceInfoBadge}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-full hover:bg-white/80 flex items-center justify-center flex-shrink-0 transition-colors"
          aria-label="Supprimer ce bloc"
        >
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      {/* L-13: Category buttons + Vider button when locked.
          The pills live in their own wrap-flex container so the Vider button
          can't interleave between wrapped category lines on narrow screens.
          On desktop the Vider sits to the right; on mobile it stacks below. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 mb-3">
        <div className="flex gap-2 flex-wrap items-center flex-1 min-w-0">
        {favorites.length > 0 && (() => {
          const disabled = !isPillAllowedWhenLocked('FAVORITES');
          return (
            <button
              type="button"
              onClick={() => handleCategoryChange('FAVORITES')}
              disabled={disabled}
              aria-disabled={disabled}
              className={`
                px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
                ${activeCategoryId === 'FAVORITES'
                  ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                  : disabled
                    ? 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                }
              `}
            >
              <Star size={14} className={activeCategoryId === 'FAVORITES' ? 'fill-amber-400 text-amber-400' : ''} />
              Favoris
            </button>
          );
        })()}
        {packs.length > 0 && (() => {
          const disabled = !isPillAllowedWhenLocked('PACKS');
          const activePill = activeCategoryId === 'PACKS';
          return (
            <button
              type="button"
              onClick={() => handleCategoryChange('PACKS')}
              disabled={disabled}
              aria-disabled={disabled}
              className={`
                px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
                ${activePill
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                  : disabled
                    ? 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                }
              `}
            >
              <Package size={14} />
              Packs
            </button>
          );
        })()}
        {categories.map((cat) => {
          const isActivePill = cat.id === activeCategoryId;
          const disabled = !isPillAllowedWhenLocked(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.id)}
              disabled={disabled}
              aria-disabled={disabled}
              className={`
                px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border
                ${isActivePill
                  ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                  : disabled
                    ? 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                }
              `}
            >
              <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={14} className="shrink-0" />
              {cat.name}
            </button>
          );
        })}
        </div>
        {isLocked && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-700 transition-colors self-start whitespace-nowrap"
          >
            Vider
          </button>
        )}
      </div>

      {/* Service grid */}
      {activeCategoryId !== 'PACKS' && (
        <ServiceGrid
          services={filteredServices}
          favorites={activeCategoryId === 'FAVORITES' ? favorites : []}
          categories={categories}
          selectedItems={block.items}
          onToggleItem={onToggleItem}
          lockedCategoryId={lockedCategoryId}
        />
      )}

      {/* Packs grid */}
      {activeCategoryId === 'PACKS' && (
        <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2 mt-3">
          {packs.map((pack) => {
            const discount = getPackDiscount(pack);
            const isSelected = block.packId === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => onAddPackBlocks?.(pack)}
                className={`p-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? 'bg-emerald-50 border-2 border-emerald-400 shadow-sm'
                    : 'bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <div className="text-xs text-emerald-600 font-medium mb-1">
                  {formatPackItemCount(pack)}
                  {discount > 0 && ` · -${discount}%`}
                </div>
                <div className="text-sm font-medium text-slate-900 truncate">{pack.name}</div>
                <div className="text-sm font-semibold text-slate-700 mt-1">{formatPrice(pack.price)}</div>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}
