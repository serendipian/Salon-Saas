import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Brand } from '../../../types';
import { ColorPicker } from '../../services/components/ColorPicker';
import { useSuppliers } from '../../suppliers/hooks/useSuppliers';
import { useProducts } from '../hooks/useProducts';

export function BrandsTab() {
  const { brands, updateBrands } = useProducts();
  const { allSuppliers } = useSuppliers();

  const [localBrands, setLocalBrands] = useState<Brand[]>(brands);

  useEffect(() => {
    setLocalBrands(brands);
  }, [brands]);

  const handleAddBrand = () => {
    const newBrand: Brand = {
      id: crypto.randomUUID(),
      name: '',
      color: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    setLocalBrands([...localBrands, newBrand]);
  };

  const handleDeleteBrand = (id: string) => {
    setLocalBrands(localBrands.filter((b) => b.id !== id));
  };

  const handleUpdateBrand = (id: string, updates: Partial<Brand>) => {
    setLocalBrands(localBrands.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleMoveBrand = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localBrands.length) return;
    const updated = [...localBrands];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLocalBrands(updated);
  };

  const hasChanges = JSON.stringify(localBrands) !== JSON.stringify(brands);
  const hasEmptyNames = localBrands.some((b) => !b.name.trim());

  const handleSave = () => {
    if (hasEmptyNames) return;
    updateBrands(localBrands);
  };

  return (
    <div className="space-y-4">
      {localBrands.map((brand, index) => (
        <div key={brand.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleMoveBrand(index, 'up')}
                disabled={index === 0}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleMoveBrand(index, 'down')}
                disabled={index === localBrands.length - 1}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowDown size={14} />
              </button>
            </div>

            <ColorPicker
              selectedColor={brand.color}
              onSelect={(color) => handleUpdateBrand(brand.id, { color })}
            />

            <input
              type="text"
              value={brand.name}
              onChange={(e) => handleUpdateBrand(brand.id, { name: e.target.value })}
              placeholder="Nom de la marque"
              className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none ${!brand.name.trim() ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
            />

            <select
              value={brand.supplierId ?? ''}
              onChange={(e) =>
                handleUpdateBrand(brand.id, { supplierId: e.target.value || undefined })
              }
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white max-w-[180px]"
            >
              <option value="">Aucun fournisseur</option>
              {allSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleDeleteBrand(brand.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      {localBrands.length === 0 && (
        <div className="text-center py-8 text-sm text-slate-400">
          Aucune marque. Ajoutez votre première marque ci-dessous.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddBrand}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Plus size={16} />
          Ajouter une marque
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges || hasEmptyNames}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            hasChanges && !hasEmptyNames
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
