import React from 'react';
import { Pencil, Save, X, Loader2 } from 'lucide-react';
import type { WorkSchedule } from '../../../types';

// --- Read-only field display ---
export const Field: React.FC<{ label: string; value?: string | number | null }> = ({
  label,
  value,
}) => (
  <div>
    <dt className="text-sm text-slate-500">{label}</dt>
    <dd className="text-sm text-slate-900 mt-0.5">{value || '—'}</dd>
  </div>
);

// --- Section header with edit/save/cancel ---
export const SectionHeader: React.FC<{
  title: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  canEdit?: boolean;
}> = ({ title, editing, onEdit, onSave, onCancel, isSaving, canEdit = true }) => (
  <div className="flex items-center justify-between mb-5">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {editing ? (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <X size={14} />
          Annuler
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
      </div>
    ) : canEdit ? (
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
      >
        <Pencil size={14} />
        Modifier
      </button>
    ) : null}
  </div>
);

// --- Constants ---
export const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

export const ORDERED_DAYS: (keyof WorkSchedule)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const CONTRACT_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  Freelance: 'Freelance',
  Apprentissage: 'Apprentissage',
  Stage: 'Stage',
};

// L-22: Centralizes contract chip colors so TeamCard / TeamTable / future
// staff displays don't drift apart. Previously duplicated in TeamCard.tsx.
export const CONTRACT_COLORS: Record<string, string> = {
  CDI: 'bg-blue-100 text-blue-700',
  CDD: 'bg-amber-100 text-amber-700',
  Freelance: 'bg-purple-100 text-purple-700',
  Apprentissage: 'bg-teal-100 text-teal-700',
  Stage: 'bg-slate-100 text-slate-600',
};

// --- Helpers ---
export const formatDate = (d?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
};
