import React from 'react';
import { Plus, Package, AlertTriangle, Star, Trash2, Edit3 } from 'lucide-react';
import type { Pack } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { isPackValid, getPackDiscount } from '../utils/packExpansion';

interface PackListProps {
  packs: Pack[];
  onAdd: () => void;
  onEdit: (pack: Pack) => void;
  onDelete: (packId: string) => void;
  onToggleActive: (packId: string, active: boolean) => void;
  onToggleFavorite?: (packId: string, isFavorite: boolean) => void;
}

export const PackList: React.FC<PackListProps> = ({
  packs,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFavorite,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Packs</h2>
          <p className="text-sm text-slate-500">{packs.length} pack{packs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Nouveau Pack
        </button>
      </div>

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 mb-2">Aucun pack créé</p>
          <p className="text-sm text-slate-400">Créez des packs pour regrouper vos services avec un prix réduit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((pack) => {
            const valid = isPackValid(pack);
            const discount = getPackDiscount(pack);
            const totalOriginal = pack.items.reduce((s, i) => s + i.originalPrice, 0);

            return (
              <div
                key={pack.id}
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
                      {pack.items.length} service{pack.items.length !== 1 ? 's' : ''} · {formatPrice(totalOriginal)} → <span className="font-semibold text-slate-800">{formatPrice(pack.price)}</span>
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
                      onClick={() => onDelete(pack.id)}
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
          })}
        </div>
      )}
    </div>
  );
};
