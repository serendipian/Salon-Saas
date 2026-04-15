import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SupplierSettings } from '../../../types';
import { useSupplierSettings } from '../hooks/useSupplierSettings';

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Comptant', label: 'Comptant' },
  { value: '15 jours', label: '15 jours' },
  { value: '30 jours', label: '30 jours' },
  { value: '45 jours', label: '45 jours' },
  { value: '60 jours', label: '60 jours' },
  { value: '90 jours', label: '90 jours' },
];

export function SupplierGeneralTab() {
  const { supplierSettings, updateSupplierSettings } = useSupplierSettings();
  const [form, setForm] = useState<SupplierSettings>(supplierSettings);

  useEffect(() => {
    setForm(supplierSettings);
  }, [supplierSettings]);

  const handleSave = () => {
    updateSupplierSettings(form);
  };

  const hasChanges = JSON.stringify(form) !== JSON.stringify(supplierSettings);

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Paramètres généraux
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Conditions de paiement par défaut
            </label>
            <select
              value={form.defaultPaymentTerms}
              onChange={(e) => setForm({ ...form, defaultPaymentTerms: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            >
              {PAYMENT_TERMS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Préfixe bon de commande
            </label>
            <input
              type="text"
              value={form.poPrefix}
              onChange={(e) => setForm({ ...form, poPrefix: e.target.value })}
              placeholder="BC-"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prochain numéro</label>
            <input
              type="number"
              min={1}
              value={form.poNextNumber}
              onChange={(e) => setForm({ ...form, poNextNumber: parseInt(e.target.value, 10) || 1 })}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            />
            <p className="text-xs text-slate-500 mt-1">
              Prochain bon de commande : {form.poPrefix}
              {String(form.poNextNumber).padStart(4, '0')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Vue par défaut</p>
              <p className="text-xs text-slate-500">
                Mode d'affichage par défaut de la liste des fournisseurs
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
