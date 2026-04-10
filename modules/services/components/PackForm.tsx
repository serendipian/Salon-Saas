import React, { useState, useMemo } from 'react';
import { ArrowLeft, AlertTriangle, Plus, Minus } from 'lucide-react';
import type { Pack, PackGroup, Service, ServiceCategory } from '../../../types';
import { formatPrice, formatDuration } from '../../../lib/format';
import { packSchema } from '../packSchemas';
import { useFormValidation } from '../../../hooks/useFormValidation';
import { CategoryIcon } from '../../../lib/categoryIcons';

interface PackFormProps {
  existingPack?: Pack;
  services: Service[];
  categories: ServiceCategory[];
  packGroups: PackGroup[];
  onSave: (data: { id?: string; name: string; description: string; price: number; groupId: string | null; items: Array<{ serviceId: string; serviceVariantId: string }> }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const PackForm: React.FC<PackFormProps> = ({
  existingPack,
  services,
  categories,
  packGroups,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  const [name, setName] = useState(existingPack?.name ?? '');
  const [description, setDescription] = useState(existingPack?.description ?? '');
  const [price, setPrice] = useState(existingPack?.price?.toString() ?? '');
  const [groupId, setGroupId] = useState<string | null>(existingPack?.groupId ?? null);
  const [selectedItems, setSelectedItems] = useState<Array<{ serviceId: string; serviceVariantId: string }>>(
    existingPack?.items.map((i) => ({ serviceId: i.serviceId, serviceVariantId: i.serviceVariantId })) ?? []
  );
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const { errors, validate, clearFieldError } = useFormValidation(packSchema);

  const activeServices = useMemo(
    () => services.filter((s) => s.active && s.variants.length > 0),
    [services],
  );

  const servicesByCategory = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const svc of activeServices) {
      const list = map.get(svc.categoryId) ?? [];
      list.push(svc);
      map.set(svc.categoryId, list);
    }
    return map;
  }, [activeServices]);

  const totalOriginal = useMemo(() => {
    let total = 0;
    for (const item of selectedItems) {
      const svc = services.find((s) => s.id === item.serviceId);
      const variant = svc?.variants.find((v) => v.id === item.serviceVariantId);
      total += variant?.price ?? 0;
    }
    return total;
  }, [selectedItems, services]);

  const priceNum = parseFloat(price) || 0;
  const discountPercent = totalOriginal > 0 ? Math.round(((totalOriginal - priceNum) / totalOriginal) * 100) : 0;
  // M-23: Block save when the pack costs more than (or equal to) the sum of
  // its items' original prices — that's a negative-discount pack and almost
  // always a typo. The price summary card already warns visually; this just
  // makes the warning load-bearing.
  const isOverCost = priceNum > 0 && totalOriginal > 0 && priceNum >= totalOriginal;

  const getVariantCount = (variantId: string) =>
    selectedItems.reduce((n, i) => (i.serviceVariantId === variantId ? n + 1 : n), 0);

  const addVariant = (serviceId: string, variantId: string) => {
    setSelectedItems((prev) => [...prev, { serviceId, serviceVariantId: variantId }]);
    clearFieldError('items');
  };

  const removeVariant = (variantId: string) => {
    setSelectedItems((prev) => {
      // Remove the LAST occurrence so consecutive clicks peel off in reverse order.
      const lastIdx = prev.map((i) => i.serviceVariantId).lastIndexOf(variantId);
      if (lastIdx < 0) return prev;
      return [...prev.slice(0, lastIdx), ...prev.slice(lastIdx + 1)];
    });
  };

  const handleSubmit = () => {
    if (isOverCost) return; // M-23 belt-and-braces — button is also disabled
    const formData = {
      name,
      description,
      price: priceNum,
      items: selectedItems,
    };
    const result = validate(formData);
    if (!result) return;

    onSave({
      id: existingPack?.id,
      name,
      description,
      price: priceNum,
      groupId,
      items: selectedItems,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-semibold text-slate-900">
          {existingPack ? 'Modifier le pack' : 'Nouveau pack'}
        </h2>
      </div>

      {/* Name & Description */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
            placeholder="Ex: Pack Mariée Complet"
            className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description optionnelle..."
            rows={2}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prix du pack *</label>
          <input
            type="number"
            value={price}
            onChange={(e) => { setPrice(e.target.value); clearFieldError('price'); }}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${errors.price ? 'border-red-400' : 'border-slate-200'}`}
          />
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Groupe</label>
          <select
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value || null)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">Aucun groupe</option>
            {packGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Regrouper ce pack dans une collection (ex: Halloween, Été)</p>
        </div>
      </div>

      {/* Price summary */}
      {selectedItems.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Prix original total</span>
            <span className="text-slate-700">{formatPrice(totalOriginal)}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Prix du pack</span>
            <span className="font-semibold text-slate-900">{formatPrice(priceNum)}</span>
          </div>
          {priceNum > 0 && totalOriginal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Réduction</span>
              <span className={`font-semibold ${discountPercent > 0 ? 'text-emerald-600' : discountPercent < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                {discountPercent > 0 ? `-${discountPercent}%` : discountPercent < 0 ? `+${Math.abs(discountPercent)}%` : '0%'}
              </span>
            </div>
          )}
          {isOverCost && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
              <AlertTriangle size={12} />
              Le prix du pack doit être inférieur au prix total des services
            </div>
          )}
        </div>
      )}

      {/* Service picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Services inclus * <span className="text-slate-400 font-normal">({selectedItems.length} sélectionné{selectedItems.length !== 1 ? 's' : ''})</span>
        </label>
        {errors.items && <p className="text-xs text-red-500 mb-2">{errors.items}</p>}

        <div className="space-y-2">
          {categories.map((cat) => {
            const catServices = servicesByCategory.get(cat.id) ?? [];
            if (catServices.length === 0) return null;
            const isExpanded = expandedCategoryId === cat.id;
            const selectedInCat = selectedItems.filter((i) =>
              catServices.some((s) => s.id === i.serviceId)
            ).length;

            return (
              <div key={cat.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={16} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-900">{cat.name}</span>
                    {selectedInCat > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{selectedInCat}</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{catServices.length} service{catServices.length > 1 ? 's' : ''}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
                    {catServices.map((svc) => (
                      <div key={svc.id}>
                        <p className="text-xs font-medium text-slate-600 mb-1.5 px-1">{svc.name}</p>
                        <div className="space-y-1">
                          {svc.variants.map((variant) => {
                            const count = getVariantCount(variant.id);
                            const selected = count > 0;
                            return (
                              <div
                                key={variant.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                  selected
                                    ? 'bg-blue-50 border border-blue-300 text-blue-900'
                                    : 'bg-white border border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate">{variant.name}</span>
                                  <span className="text-xs text-slate-400 shrink-0">{formatDuration(variant.durationMinutes)}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-medium">{formatPrice(variant.price)}</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => removeVariant(variant.id)}
                                      disabled={count === 0}
                                      aria-label="Retirer"
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                        count === 0
                                          ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                          : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-100'
                                      }`}
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className={`w-6 text-center font-semibold tabular-nums ${selected ? 'text-blue-900' : 'text-slate-400'}`}>
                                      {count}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => addVariant(svc.id, variant.id)}
                                      aria-label="Ajouter"
                                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving || isOverCost}
          title={isOverCost ? 'Le prix du pack doit être inférieur au prix total des services' : undefined}
          className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Enregistrement...' : existingPack ? 'Mettre à jour' : 'Créer le pack'}
        </button>
      </div>
    </div>
  );
};
