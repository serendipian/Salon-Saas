import { Loader2, Pencil, Phone, Save, User, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Input } from '../../../components/FormElements';
import { useToast } from '../../../context/ToastContext';
import type { StaffMember } from '../../../types';

interface ProfileEmergencyCardProps {
  staff: StaffMember;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
}

export const ProfileEmergencyCard: React.FC<ProfileEmergencyCardProps> = ({
  staff,
  onSave,
  isSaving,
}) => {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<StaffMember>>({});

  const startEdit = () => {
    setDraft({
      emergencyContactName: staff.emergencyContactName,
      emergencyContactRelation: staff.emergencyContactRelation,
      emergencyContactPhone: staff.emergencyContactPhone,
    });
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
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Contact d'urgence
        </h3>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={cancelEdit}
              disabled={isSaving}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
            <button
              onClick={saveSection}
              disabled={isSaving}
              className="p-1.5 text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Input
            label="Nom du contact"
            value={draft.emergencyContactName ?? ''}
            onChange={(e) => setDraft({ ...draft, emergencyContactName: e.target.value })}
          />
          <Input
            label="Relation"
            placeholder="Ex: Époux"
            value={draft.emergencyContactRelation ?? ''}
            onChange={(e) => setDraft({ ...draft, emergencyContactRelation: e.target.value })}
          />
          <Input
            label="Téléphone"
            type="tel"
            value={draft.emergencyContactPhone ?? ''}
            onChange={(e) => setDraft({ ...draft, emergencyContactPhone: e.target.value })}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <User size={14} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-slate-900">
                {staff.emergencyContactName || '—'}
              </div>
              <div className="text-xs text-slate-500">
                {staff.emergencyContactRelation || 'Contact'}
              </div>
            </div>
          </li>
          <li className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <Phone size={14} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-slate-900">
                {staff.emergencyContactPhone || '—'}
              </div>
              <div className="text-xs text-slate-500">Téléphone d'urgence</div>
            </div>
          </li>
        </ul>
      )}
    </div>
  );
};
