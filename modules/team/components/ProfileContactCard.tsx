import React, { useState } from 'react';
import { Mail, Phone, Pencil, Save, X, Loader2 } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { Input } from '../../../components/FormElements';
import { useToast } from '../../../context/ToastContext';

interface ProfileContactCardProps {
  staff: StaffMember;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
}

export const ProfileContactCard: React.FC<ProfileContactCardProps> = ({ staff, onSave, isSaving }) => {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<StaffMember>>({});

  const startEdit = () => {
    setDraft({ email: staff.email, phone: staff.phone });
    setEditing(true);
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
      addToast({ type: 'error', message: 'Impossible de sauvegarder' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Coordonnées</h3>
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
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Input label="Email" type="email" value={draft.email ?? ''} onChange={e => setDraft({ ...draft, email: e.target.value })} />
          <Input label="Téléphone" type="tel" value={draft.phone ?? ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
        </div>
      ) : (
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <Phone size={14} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-slate-900">{staff.phone || '—'}</div>
              <div className="text-xs text-slate-500">Téléphone</div>
            </div>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <Mail size={14} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-slate-900 truncate">{staff.email || '—'}</div>
              <div className="text-xs text-slate-500">Email</div>
            </div>
          </li>
        </ul>
      )}
    </div>
  );
};
