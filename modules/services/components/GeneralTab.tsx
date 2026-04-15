import { Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { ServiceSettings } from '../../../types';
import { useServiceSettings } from '../hooks/useServiceSettings';

export function GeneralTab() {
  const { serviceSettings, updateServiceSettings } = useServiceSettings();
  const [form, setForm] = useState<ServiceSettings>(serviceSettings);

  useEffect(() => {
    setForm(serviceSettings);
  }, [serviceSettings]);

  const handleSave = () => {
    updateServiceSettings(form);
  };

  const hasChanges = JSON.stringify(form) !== JSON.stringify(serviceSettings);

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Paramètres généraux
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Durée par défaut
            </label>
            <div className="relative">
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={form.defaultDuration}
                onChange={(e) =>
                  setForm({ ...form, defaultDuration: parseInt(e.target.value) || 60 })
                }
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                min
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom de variante par défaut
            </label>
            <input
              type="text"
              value={form.defaultVariantName}
              onChange={(e) => setForm({ ...form, defaultVariantName: e.target.value })}
              placeholder="Standard"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Afficher les coûts et marges</p>
              <p className="text-xs text-slate-500">
                Affiche les colonnes Coût et Marge dans la vue tableau des services
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.showCostsInList}
              onClick={() => setForm({ ...form, showCostsInList: !form.showCostsInList })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.showCostsInList ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  form.showCostsInList ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Vue par défaut</p>
              <p className="text-xs text-slate-500">
                Mode d'affichage par défaut de la liste des services
              </p>
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultView: 'card' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.defaultView === 'card'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Cartes
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultView: 'table' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.defaultView === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tableau
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
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
