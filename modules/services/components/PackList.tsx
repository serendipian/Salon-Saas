import React, { useMemo, useState } from 'react';
import { Plus, Package, AlertTriangle, Star, Trash2, Edit3, FolderPlus, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import type { Pack, PackGroup } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { isPackValid, getPackDiscount, formatPackItemCount, isPackGroupLive } from '../utils/packExpansion';

interface PackListProps {
  packs: Pack[];
  packGroups: PackGroup[];
  onAdd: () => void;
  onEdit: (pack: Pack) => void;
  onDelete: (packId: string) => void;
  onToggleActive: (packId: string, active: boolean) => void;
  onToggleFavorite?: (packId: string, isFavorite: boolean) => void;
  onAddGroup?: () => void;
  onEditGroup?: (group: PackGroup) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupActive?: (groupId: string, active: boolean) => void;
}

const GROUP_COLOR_CLASSES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
};

const formatDateRange = (startsAt: string | null, endsAt: string | null): string | null => {
  if (!startsAt && !endsAt) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  if (startsAt && endsAt) return `${fmt(startsAt)} — ${fmt(endsAt)}`;
  if (startsAt) return `Dès le ${fmt(startsAt)}`;
  return `Jusqu'au ${fmt(endsAt!)}`;
};

const PackRow: React.FC<{
  pack: Pack;
  onEdit: (pack: Pack) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleFavorite?: (id: string, isFavorite: boolean) => void;
}> = ({ pack, onEdit, onDelete, onToggleActive, onToggleFavorite }) => {
  const valid = isPackValid(pack);
  const discount = getPackDiscount(pack);
  const totalOriginal = pack.items.reduce((s, i) => s + i.originalPrice, 0);

  return (
    <div
      className={`bg-white rounded-xl border p-4 transition-all ${
        !pack.active ? 'opacity-60 border-slate-200' : valid ? 'border-slate-200 hover:border-slate-300' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 truncate">{pack.name}</h3>
            {!valid && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                <AlertTriangle size={12} />
                Invalide
              </span>
            )}
            {discount > 0 && valid && (
              <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                -{discount}%
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {formatPackItemCount(pack)} · {formatPrice(totalOriginal)} → <span className="font-semibold text-slate-800">{formatPrice(pack.price)}</span>
          </p>
          {pack.description && (
            <p className="text-xs text-slate-400 mt-1 truncate">{pack.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(pack.id, !pack.isFavorite)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              title={pack.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Star
                size={16}
                className={pack.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}
              />
            </button>
          )}
          <button
            onClick={() => onEdit(pack)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Edit3 size={16} className="text-slate-500" />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Supprimer le pack "${pack.name}" ? Cette action est irréversible.`)) {
                onDelete(pack.id);
              }
            }}
            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
          </button>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={pack.active}
              onChange={() => onToggleActive(pack.id, !pack.active)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>
      </div>
    </div>
  );
};

export const PackList: React.FC<PackListProps> = ({
  packs,
  packGroups,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFavorite,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onToggleGroupActive,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const packsByGroup = useMemo(() => {
    const map = new Map<string | null, Pack[]>();
    for (const pack of packs) {
      const key = pack.groupId ?? null;
      const list = map.get(key) ?? [];
      list.push(pack);
      map.set(key, list);
    }
    return map;
  }, [packs]);

  const ungroupedPacks = packsByGroup.get(null) ?? [];
  const hasAnyGroups = packGroups.length > 0;

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Packs</h2>
          <p className="text-sm text-slate-500">{packs.length} pack{packs.length !== 1 ? 's' : ''}{hasAnyGroups ? ` · ${packGroups.length} groupe${packGroups.length !== 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {onAddGroup && (
            <button
              onClick={onAddGroup}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              <FolderPlus size={16} />
              Nouveau groupe
            </button>
          )}
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Nouveau Pack
          </button>
        </div>
      </div>

      {packs.length === 0 && !hasAnyGroups ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 mb-2">Aucun pack créé</p>
          <p className="text-sm text-slate-400">Créez des packs pour regrouper vos services avec un prix réduit</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ungrouped packs */}
          {ungroupedPacks.length > 0 && (
            <div>
              {hasAnyGroups && (
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sans groupe</h3>
              )}
              <div className="space-y-3">
                {ungroupedPacks.map((pack) => (
                  <PackRow
                    key={pack.id}
                    pack={pack}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {packGroups.map((group) => {
            const groupPacks = packsByGroup.get(group.id) ?? [];
            const isCollapsed = collapsedGroups.has(group.id);
            const colorClass = group.color ? GROUP_COLOR_CLASSES[group.color] ?? GROUP_COLOR_CLASSES.slate : GROUP_COLOR_CLASSES.slate;
            const live = isPackGroupLive(group);
            const dateRange = formatDateRange(group.startsAt, group.endsAt);

            return (
              <div key={group.id} className={`rounded-2xl border ${group.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-75'}`}>
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <button
                    onClick={() => toggleCollapse(group.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    {isCollapsed ? <ChevronRight size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorClass} shrink-0`}>
                      {group.name}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {groupPacks.length} pack{groupPacks.length !== 1 ? 's' : ''}
                    </span>
                    {dateRange && (
                      <span className={`flex items-center gap-1 text-xs shrink-0 ${live ? 'text-slate-400' : 'text-amber-600'}`}>
                        <Calendar size={11} />
                        {dateRange}
                      </span>
                    )}
                    {!live && group.active && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">Hors période</span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {onEditGroup && (
                      <button
                        onClick={() => onEditGroup(group)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Edit3 size={16} className="text-slate-500" />
                      </button>
                    )}
                    {onDeleteGroup && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Supprimer le groupe "${group.name}" ? Les packs de ce groupe seront simplement dégroupés.`)) {
                            onDeleteGroup(group.id);
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                      </button>
                    )}
                    {onToggleGroupActive && (
                      <label className="relative inline-flex items-center cursor-pointer" title={group.active ? 'Désactiver le groupe' : 'Activer le groupe'}>
                        <input
                          type="checkbox"
                          checked={group.active}
                          onChange={() => onToggleGroupActive(group.id, !group.active)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-3 space-y-2">
                    {groupPacks.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">Aucun pack dans ce groupe</p>
                    ) : (
                      groupPacks.map((pack) => (
                        <PackRow
                          key={pack.id}
                          pack={pack}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onToggleActive={onToggleActive}
                          onToggleFavorite={onToggleFavorite}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
