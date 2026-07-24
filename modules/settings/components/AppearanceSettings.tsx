import { Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type React from 'react';
import { useSyncExternalStore } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { useSidebar } from '../../../hooks/useSidebar';
import {
  ACCENT_PALETTES,
  getAccentId,
  setAccentId,
  subscribeAccent,
} from '../../../lib/appearancePrefs';

/**
 * Réglages → Apparence.
 *
 * Home for shell-level display preferences. The sidebar pin used to be a button
 * in the top bar; it lives here so the bar stays free of global controls.
 */
export const AppearanceSettings: React.FC = () => {
  const { isExpanded, toggleExpanded } = useSidebar();
  const { isMobile, isTabletPortrait } = useMediaQuery();
  const accentId = useSyncExternalStore(subscribeAccent, getAccentId, () => 'blue');

  // The pin only applies to the desktop rail — mobile uses a drawer, and
  // tablet-portrait is forced collapsed for width reasons.
  const pinUnavailable = isMobile || isTabletPortrait;

  return (
    <div className="w-full pb-10 animate-in fade-in duration-300">
      <PageHeader
        title="Apparence"
        subtitle="Affichage de l'interface"
        backTo="/settings"
        backLabel="Retour aux réglages"
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Couleur principale</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Utilisée pour les boutons principaux, l'élément actif du menu et les champs
            sélectionnés.
          </p>
        </div>

        <div className="px-5 py-4 flex flex-wrap gap-3">
          {ACCENT_PALETTES.map((palette) => {
            const selected = palette.id === accentId;
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => setAccentId(palette.id)}
                aria-pressed={selected}
                aria-label={`Couleur ${palette.label}`}
                className={`group flex flex-col items-center gap-1.5 outline-none rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-accent-300/60`}
              >
                <span
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center transition-transform group-hover:scale-105 ${
                    selected ? 'ring-2 ring-offset-2 ring-slate-900' : 'ring-1 ring-slate-900/10'
                  }`}
                  style={{ backgroundColor: palette.shades[5] }}
                >
                  {selected && <Check size={16} className="text-white" strokeWidth={3} />}
                </span>
                <span
                  className={`text-[11px] ${selected ? 'font-semibold text-slate-900' : 'text-slate-500'}`}
                >
                  {palette.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Menu latéral</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Le menu s'ouvre au survol par défaut. Épinglez-le pour le garder ouvert.
          </p>
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-slate-50 rounded-lg text-slate-500 shrink-0">
              {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">Épingler le menu latéral</p>
              <p className="text-xs text-slate-500">
                {pinUnavailable
                  ? 'Disponible uniquement sur grand écran.'
                  : isExpanded
                    ? 'Le menu reste ouvert en permanence.'
                    : "Le menu reste replié et s'ouvre au survol."}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isExpanded}
            aria-label="Épingler le menu latéral"
            disabled={pinUnavailable}
            onClick={toggleExpanded}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-300/60 disabled:opacity-40 disabled:cursor-not-allowed ${
              isExpanded ? 'bg-accent-500' : 'bg-slate-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                isExpanded ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
