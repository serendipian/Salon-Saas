import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { Input } from '../../../components/FormElements';
import { Field, SectionHeader } from './profile-shared';

interface ProfilePiiSectionProps {
  staff: StaffMember;
  loadPii: () => Promise<Partial<StaffMember>>;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
  currencySymbol: string;
}

export const ProfilePiiSection: React.FC<ProfilePiiSectionProps> = ({ staff, loadPii, onSave, isSaving, currencySymbol }) => {
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
    } finally {
      setPiiLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
  };

  const saveSection = async () => {
    await onSave(draft);
    setEditing(false);
    setDraft({});
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader
        title="Donnees sensibles"
        editing={editing}
        onEdit={startEdit}
        onSave={saveSection}
        onCancel={cancelEdit}
        isSaving={isSaving}
      />

      {piiLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Chargement des donnees...
        </div>
      )}

      {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            label="Numero Securite Sociale"
            value={draft.socialSecurityNumber ?? ''}
            onChange={e => setDraft({ ...draft, socialSecurityNumber: e.target.value })}
            className="sm:col-span-2"
          />
        </div>
      ) : !piiLoading ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={`Salaire de base (${currencySymbol})`} value={staff.baseSalary != null ? `${staff.baseSalary} ${currencySymbol}` : undefined} />
          <Field label="IBAN" value={staff.iban ? '****' + staff.iban.slice(-4) : undefined} />
          <Field label="Numero Securite Sociale" value={staff.socialSecurityNumber ? '****' + staff.socialSecurityNumber.slice(-4) : undefined} />
        </dl>
      ) : null}
    </div>
  );
};
