import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { PackGroup } from '../../../types';
import { packGroupSchema } from '../packSchemas';
import { useFormValidation } from '../../../hooks/useFormValidation';

interface PackGroupFormProps {
  existingGroup?: PackGroup;
  onSave: (data: {
    id?: string;
    name: string;
    description: string;
    color: string | null;
    startsAt: string | null;
    endsAt: string | null;
  }) => void;
  onCancel: () => void;
}

const COLOR_OPTIONS: Array<{ value: string; label: string; className: string }> = [
  { value: 'slate', label: 'Gris', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  {
    value: 'orange',
    label: 'Orange',
    className: 'bg-orange-100 text-orange-700 border-orange-300',
  },
  { value: 'amber', label: 'Ambre', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  {
    value: 'emerald',
    label: 'Vert',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
  { value: 'sky', label: 'Bleu', className: 'bg-sky-100 text-sky-700 border-sky-300' },
  {
    value: 'violet',
    label: 'Violet',
    className: 'bg-violet-100 text-violet-700 border-violet-300',
  },
  { value: 'rose', label: 'Rose', className: 'bg-rose-100 text-rose-700 border-rose-300' },
];

// Converts ISO date string (UTC) to the "YYYY-MM-DD" format an <input type=date> expects.
const toDateInput = (iso: string | null): string => {
  if (!iso) return '';
  return iso.slice(0, 10);
};

// Converts a "YYYY-MM-DD" value back to an ISO string. Start dates snap to
// 00:00 UTC; end dates snap to 23:59:59.999 UTC so the selected day is
// inclusive (group remains live through the whole end day).
const fromDateInput = (value: string, kind: 'start' | 'end'): string | null => {
  if (!value) return null;
  const time = kind === 'end' ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  return new Date(`${value}${time}`).toISOString();
};

export const PackGroupForm: React.FC<PackGroupFormProps> = ({
  existingGroup,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(existingGroup?.name ?? '');
  const [description, setDescription] = useState(existingGroup?.description ?? '');
  const [color, setColor] = useState<string | null>(existingGroup?.color ?? null);
  const [startsAt, setStartsAt] = useState(toDateInput(existingGroup?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toDateInput(existingGroup?.endsAt ?? null));

  // L-17: Zod-based validation via useFormValidation, replacing the inline
  // if/then checks. Date comparison happens against ISO strings so the refine
  // matches what gets saved.
  const { errors, validate, clearFieldError } = useFormValidation(packGroupSchema);
  const nameError = errors.name;
  const dateError = errors.endsAt;

  const handleSubmit = () => {
    const startsAtIso = fromDateInput(startsAt, 'start');
    const endsAtIso = fromDateInput(endsAt, 'end');
    const validated = validate({
      name: name.trim(),
      description,
      color,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    });
    if (!validated) return;

    onSave({
      id: existingGroup?.id,
      name: name.trim(),
      description,
      color,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-semibold text-slate-900">
          {existingGroup ? 'Modifier le groupe' : 'Nouveau groupe'}
        </h2>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError('name');
            }}
            placeholder="Ex: Halloween 2026"
            className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${nameError ? 'border-red-400' : 'border-slate-200'}`}
          />
          {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
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
          <label className="block text-sm font-medium text-slate-700 mb-2">Couleur</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                color === null
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              Aucune
            </button>
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColor(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${opt.className} ${
                  color === opt.value ? 'ring-2 ring-offset-1 ring-slate-900' : ''
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Début</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  clearFieldError('endsAt');
                }}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${dateError ? 'border-red-400' : 'border-slate-200'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fin</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  clearFieldError('endsAt');
                }}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${dateError ? 'border-red-400' : 'border-slate-200'}`}
              />
            </div>
          </div>
          {dateError ? (
            <p className="text-xs text-red-500 mt-1">{dateError}</p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              Optionnel. Le groupe sera automatiquement masqué en dehors de cette période.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          {existingGroup ? 'Mettre à jour' : 'Créer le groupe'}
        </button>
      </div>
    </div>
  );
};
