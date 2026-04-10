import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Star, GripVertical, ChevronDown, ChevronRight, Save, Package } from 'lucide-react';
import { useServices } from '../hooks/useServices';
import { usePacks } from '../hooks/usePacks';
import { CategoryIcon } from '../../../lib/categoryIcons';
import type { FavoriteItem } from '../../../types';

export function FavoritesTab() {
  const { allServices, serviceCategories, favorites, toggleFavorite, reorderFavorites } = useServices();
  const { packs } = usePacks();

  // Merge pack favorites into the favorites list (packs keep their own favorite
  // state in the packs table, so they aren't part of useServices.favorites).
  const allFavorites = useMemo<FavoriteItem[]>(() => {
    const packFavs: FavoriteItem[] = packs
      .filter((p) => p.isFavorite)
      .map((p) => ({ type: 'pack' as const, pack: p, sortOrder: p.favoriteSortOrder ?? 0 }));
    return [...favorites, ...packFavs].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [favorites, packs]);

  const [localOrder, setLocalOrder] = useState<FavoriteItem[]>(allFavorites);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalOrder(allFavorites);
  }, [allFavorites]);

  const getFavoriteId = (f: FavoriteItem): string => {
    if (f.type === 'service') return f.service.id;
    if (f.type === 'variant') return f.variant.id;
    return f.pack.id;
  };

  const hasOrderChanged = JSON.stringify(localOrder.map(f => {
    return `${f.type}:${getFavoriteId(f)}`;
  })) !== JSON.stringify(allFavorites.map(f => {
    return `${f.type}:${getFavoriteId(f)}`;
  }));

  const handleSaveOrder = async () => {
    const items = localOrder.map((item, index) => ({
      type: item.type,
      id: getFavoriteId(item),
      sortOrder: index,
    }));
    try {
      await reorderFavorites(items);
      // On success the mutation invalidates ['services'] and ['packs'], the
      // base lists refetch, allFavorites recomputes, and the useEffect at
      // line 24 syncs localOrder back to the canonical server order.
    } catch {
      // M-20: RPC failed (permission denied, network blip, advisory lock
      // contention). The mutation's onError already toasts via
      // useMutationToast — roll the optimistic UI back so the user doesn't
      // keep staring at an order that's not on the server. allFavorites is
      // still the last-known server state because no invalidation fired.
      setLocalOrder(allFavorites);
    }
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...localOrder];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setLocalOrder(updated);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const getFavoriteLabel = (item: FavoriteItem): string => {
    if (item.type === 'service') return item.service.name;
    if (item.type === 'variant') return `${item.parentService.name} — ${item.variant.name}`;
    return item.pack.name;
  };

  const getFavoriteCategory = (item: FavoriteItem) => {
    if (item.type === 'service') return serviceCategories.find(c => c.id === item.service.categoryId);
    if (item.type === 'variant') return serviceCategories.find(c => c.id === item.parentService.categoryId);
    return undefined;
  };

  const isServiceFavorited = useCallback((serviceId: string) => {
    return allServices.find(s => s.id === serviceId)?.isFavorite ?? false;
  }, [allServices]);

  const isVariantFavorited = useCallback((variantId: string) => {
    for (const s of allServices) {
      for (const v of s.variants) {
        if (v.id === variantId) return v.isFavorite;
      }
    }
    return false;
  }, [allServices]);

  return (
    <div className="space-y-6">
      {/* Ordered favorites list */}
      {localOrder.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Ordre d'affichage</h3>
          <div className="space-y-1">
            {localOrder.map((item, index) => {
              const category = getFavoriteCategory(item);
              return (
                <div
                  key={`${item.type}-${getFavoriteId(item)}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border border-slate-200 cursor-grab active:cursor-grabbing transition-colors ${
                    dragIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical size={14} className="text-slate-400 shrink-0" />
                  <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
                  <span className="text-sm text-slate-800 flex-1 truncate">
                    {getFavoriteLabel(item)}
                  </span>
                  {item.type === 'variant' && (
                    <span className="text-xs text-slate-400 shrink-0">variante</span>
                  )}
                  {item.type === 'pack' && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                      <Package size={10} />
                      Pack Promo
                    </span>
                  )}
                  {category && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${category.color}`}>
                      <CategoryIcon categoryName={category.name} iconName={category.icon} size={10} />
                      {category.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {localOrder.length === 0 && (
        <div className="text-center py-8 text-sm text-slate-400">
          Aucun favori sélectionné — utilisez les étoiles sur les services, variantes ou packs.
        </div>
      )}

      {/* All services checklist */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Sélectionner les favoris</h3>
        <div className="space-y-3">
          {serviceCategories.map(cat => {
            const catServices = allServices.filter(s => s.categoryId === cat.id && s.active);
            if (catServices.length === 0) return null;
            return (
              <CategorySection
                key={cat.id}
                category={cat}
                services={catServices}
                isServiceFavorited={isServiceFavorited}
                isVariantFavorited={isVariantFavorited}
                onToggle={toggleFavorite}
              />
            );
          })}
        </div>
      </div>

      {/* Save order button */}
      {hasOrderChanged && (
        <div className="flex justify-end">
          <button
            onClick={handleSaveOrder}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            <Save size={16} />
            Enregistrer l'ordre
          </button>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  services,
  isServiceFavorited,
  isVariantFavorited,
  onToggle,
}: {
  category: { id: string; name: string; color: string; icon?: string };
  services: { id: string; name: string; variants: { id: string; name: string; isFavorite: boolean }[]; isFavorite: boolean }[];
  isServiceFavorited: (id: string) => boolean;
  isVariantFavorited: (id: string) => boolean;
  onToggle: (params: { type: 'service' | 'variant'; id: string; isFavorite: boolean }) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${category.color}`}>
          <CategoryIcon categoryName={category.name} iconName={category.icon} size={12} />
          {category.name}
        </span>
        <span className="text-xs text-slate-400">{services.length} services</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {services.map(service => (
            <div key={service.id}>
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isServiceFavorited(service.id)}
                  onChange={() => onToggle({ type: 'service', id: service.id, isFavorite: !isServiceFavorited(service.id) })}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <Star size={12} className={isServiceFavorited(service.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                <span className="text-sm font-medium text-slate-700">{service.name}</span>
                {service.variants.length > 1 && (
                  <span className="text-xs text-slate-400">({service.variants.length} variantes)</span>
                )}
              </label>

              {service.variants.length > 1 && (
                <div className="ml-8 space-y-0.5">
                  {service.variants.map(variant => (
                    <label key={variant.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVariantFavorited(variant.id)}
                        disabled={isServiceFavorited(service.id)}
                        onChange={() => onToggle({ type: 'variant', id: variant.id, isFavorite: !isVariantFavorited(variant.id) })}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 disabled:opacity-40"
                      />
                      <span className={`text-xs ${isServiceFavorited(service.id) ? 'text-slate-400' : 'text-slate-600'}`}>
                        {variant.name}
                      </span>
                      {isServiceFavorited(service.id) && (
                        <span className="text-xs text-slate-400 italic">(inclus via service)</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
