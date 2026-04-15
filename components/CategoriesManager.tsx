// components/CategoriesManager.tsx
//
// M-25: Generic categories editor extracted from the previously duplicated
// `modules/services/components/CategoriesTab.tsx` and
// `modules/products/components/ProductCategoriesTab.tsx` (~258 LOC each, 95%
// identical). Both files now reduce to ~25-line wrappers that pass in the
// type-specific bits.
//
// The component is fully type-parameterized over the category and item shapes,
// so it doesn't know about Service / Product / ServiceCategory / ProductCategory.
// Constraints are minimal — anything with `id`, `name`, `color` (and optional
// `icon`) on the category side, and `id`, `name`, `categoryId` on the item side.

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ColorPicker } from '../modules/services/components/ColorPicker';
import { IconPicker } from '../modules/services/components/IconPicker';

export interface ManagedCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface ManagedItem {
  id: string;
  name: string;
  categoryId: string;
}

export interface CategoriesSavePayload<TCategory extends ManagedCategory> {
  categories: TCategory[];
  /** Map of itemId -> new categoryId (or null to unassign). Omitted if empty. */
  assignments?: Record<string, string | null>;
}

export interface CategoriesManagerProps<
  TCategory extends ManagedCategory,
  TItem extends ManagedItem,
> {
  /** Live items from the parent's data hook (e.g., allServices, allProducts). */
  items: TItem[];
  /** Live categories from the parent's data hook. */
  categories: TCategory[];
  /** Persist categories + reassignments. Called when user clicks Enregistrer. */
  onSave: (payload: CategoriesSavePayload<TCategory>) => void;
  /**
   * Factory for a new blank category. Wrappers supply the right type
   * (ServiceCategory includes `icon: undefined`; ProductCategory does not).
   */
  createCategory: () => TCategory;
  /**
   * Whether to render the IconPicker next to each category. Services support
   * icons; products do not.
   */
  supportsIcons?: boolean;
  /** Singular/plural item label, e.g. "service"/"services" or "produit"/"produits". */
  itemLabel: { singular: string; plural: string };
  /** Placeholder for the per-category search input. */
  searchPlaceholder: string;
  /** Empty-state text when search yields nothing. */
  noItemsFoundLabel: string;
  /** Heading for the unassigned-items warning panel. */
  unassignedSectionLabel: string;
}

export function CategoriesManager<TCategory extends ManagedCategory, TItem extends ManagedItem>({
  items,
  categories,
  onSave,
  createCategory,
  supportsIcons = false,
  itemLabel,
  searchPlaceholder,
  noItemsFoundLabel,
  unassignedSectionLabel,
}: CategoriesManagerProps<TCategory, TItem>) {
  const [localCategories, setLocalCategories] = useState<TCategory[]>(categories);
  const [localAssignments, setLocalAssignments] = useState<Record<string, string | null>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setSearchTerm('');
  };

  // Reset local state when the upstream data refreshes (e.g., after save).
  useEffect(() => {
    setLocalCategories(categories);
    setLocalAssignments({});
  }, [categories]);

  // Effective categoryId map: start from current item data, overlay local assignments.
  const getEffectiveCategoryId = (item: TItem): string | null => {
    if (item.id in localAssignments) return localAssignments[item.id];
    return item.categoryId || null;
  };

  const itemsForCategory = (categoryId: string) =>
    items.filter((it) => getEffectiveCategoryId(it) === categoryId);

  const unassignedItems = items.filter((it) => getEffectiveCategoryId(it) === null);

  const filteredItems = (list: TItem[]) => {
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((it) => it.name.toLowerCase().includes(term));
  };

  const handleAddCategory = () => {
    const newCat = createCategory();
    setLocalCategories([...localCategories, newCat]);
    setExpandedId(newCat.id);
  };

  const handleDeleteCategory = (id: string) => {
    // Unassign all items from this category first
    const affected = items.filter((it) => getEffectiveCategoryId(it) === id);
    const newAssignments = { ...localAssignments };
    affected.forEach((it) => {
      newAssignments[it.id] = null;
    });
    setLocalAssignments(newAssignments);
    setLocalCategories(localCategories.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdateCategory = (id: string, updates: Partial<TCategory>) => {
    setLocalCategories(localCategories.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localCategories.length) return;
    const updated = [...localCategories];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLocalCategories(updated);
  };

  const handleToggleItem = (itemId: string, categoryId: string) => {
    const target = items.find((it) => it.id === itemId);
    if (!target) return;
    const current = getEffectiveCategoryId(target);
    setLocalAssignments({
      ...localAssignments,
      [itemId]: current === categoryId ? null : categoryId,
    });
  };

  const hasChanges =
    JSON.stringify(localCategories) !== JSON.stringify(categories) ||
    Object.keys(localAssignments).length > 0;

  const handleSave = () => {
    onSave({
      categories: localCategories,
      assignments: Object.keys(localAssignments).length > 0 ? localAssignments : undefined,
    });
  };

  // For each item, if its current effective category differs from its
  // server-side categoryId, return the previous category name (for the
  // "(depuis X)" badge in the assignment list).
  const findPreviousCategoryName = (itemId: string): string | null => {
    const item = items.find((it) => it.id === itemId);
    if (!item?.categoryId) return null;
    if (item.id in localAssignments && localAssignments[item.id] !== item.categoryId) {
      return categories.find((c) => c.id === item.categoryId)?.name ?? null;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {localCategories.map((cat, index) => (
        <div key={cat.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Category row header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'up')}
                disabled={index === 0}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'down')}
                disabled={index === localCategories.length - 1}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowDown size={14} />
              </button>
            </div>

            {supportsIcons && (
              <IconPicker
                selectedIcon={cat.icon}
                onSelect={(iconName) =>
                  handleUpdateCategory(cat.id, { icon: iconName } as Partial<TCategory>)
                }
              />
            )}

            <ColorPicker
              selectedColor={cat.color}
              onSelect={(color) => handleUpdateCategory(cat.id, { color } as Partial<TCategory>)}
            />

            <input
              type="text"
              value={cat.name}
              onChange={(e) =>
                handleUpdateCategory(cat.id, { name: e.target.value } as Partial<TCategory>)
              }
              placeholder="Nom de la catégorie"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />

            {(() => {
              const count = itemsForCategory(cat.id).length;
              return (
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {count} {count === 1 ? itemLabel.singular : itemLabel.plural}
                </span>
              );
            })()}

            <button
              type="button"
              onClick={() => handleDeleteCategory(cat.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expandedId === cat.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Expanded: item assignment */}
          {expandedId === cat.id && (
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
              <div className="relative mb-3">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredItems(items).map((item) => {
                  const isAssigned = getEffectiveCategoryId(item) === cat.id;
                  const prevCat = !isAssigned ? null : findPreviousCategoryName(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => handleToggleItem(item.id, cat.id)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm text-slate-700">{item.name}</span>
                      {prevCat && (
                        <span className="text-xs text-slate-400 italic">(depuis {prevCat})</span>
                      )}
                    </label>
                  );
                })}
                {filteredItems(items).length === 0 && (
                  <p className="text-sm text-slate-400 py-2 text-center">{noItemsFoundLabel}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Unassigned items section */}
      {unassignedItems.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            {unassignedSectionLabel} ({unassignedItems.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedItems.map((it) => (
              <span
                key={it.id}
                className="text-xs bg-white px-2 py-1 rounded border border-amber-200 text-amber-700"
              >
                {it.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddCategory}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Plus size={16} />
          Ajouter une catégorie
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            hasChanges
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Save size={16} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}
