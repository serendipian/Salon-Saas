import React, { useState } from 'react';
import { Loader2, Lock, CreditCard, Shield, Pencil, Save, X } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { Input } from '../../../components/FormElements';
import { useToast } from '../../../context/ToastContext';

interface ProfilePiiSectionProps {
  staff: StaffMember;
  loadPii: () => Promise<Partial<StaffMember>>;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
  currencySymbol: string;
}

export const ProfilePiiSection: React.FC<ProfilePiiSectionProps> = ({ staff, loadPii, onSave, isSaving, currencySymbol }) => {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<StaffMember>>({});
  const [piiLoading, setPiiLoading] = useState(false);

  const startEdit = async () => {
    setPiiLoading(true);
    try {
      const piiData = await loadPii();
      setDraft({
        baseSalary: piiData.baseSalary ?? staff.baseSalary,
        iban: piiData.iban ?? staff.iban,
        socialSecurityNumber: piiData.socialSecurityNumber ?? staff.socialSecurityNumber,
      });
      setEditing(true);
    } catch {
      addToast({ type: 'error', message: 'Impossible de charger les données sensibles' });
    } finally {
      setPiiLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
  };

  const saveSection = async () => {
    try {
      await onSave(draft);
      setEditing(false);
      setDraft({});
    } catch {
      addToast({ type: 'error', message: 'Impossible de sauvegarder les données sensibles' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Données sensibles</h3>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button onClick={cancelEdit} disabled={isSaving} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={14} />
            </button>
            <button onClick={saveSection} disabled={isSaving} className="p-1.5 text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            </button>
          </div>
        ) : (
          <button onClick={startEdit} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            {piiLoading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Input
            label={`Salaire de base (${currencySymbol})`}
            type="number"
            value={draft.baseSalary ?? ''}
            onChange={e => setDraft({ ...draft, baseSalary: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
          <Input
            label="IBAN"
            value={draft.iban ?? ''}
            onChange={e => setDraft({ ...draft, iban: e.target.value })}
            placeholder="FR76 ..."
          />
          <Input
            label="Numéro Sécurité Sociale"
            value={draft.socialSecurityNumber ?? ''}
            onChange={e => setDraft({ ...draft, socialSecurityNumber: e.target.value })}
          />
        </div>
      ) : !piiLoading ? (
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <Lock size={14} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-slate-900">{staff.baseSalary != null ? `${staff.baseSalary} ${currencySymbol}` : '—'}</div>
              <div className="text-xs text-slate-500">Salaire de base</div>
            </div>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <CreditCard size={14} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-slate-900">{staff.iban ? '••••' + staff.iban.slice(-4) : '—'}</div>
              <div className="text-xs text-slate-500">IBAN</div>
            </div>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <Shield size={14} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-slate-900">{staff.socialSecurityNumber ? '••••' + staff.socialSecurityNumber.slice(-4) : '—'}</div>
              <div className="text-xs text-slate-500">N° Sécurité Sociale</div>
            </div>
          </li>
        </ul>
      ) : null}
    </div>
  );
};
