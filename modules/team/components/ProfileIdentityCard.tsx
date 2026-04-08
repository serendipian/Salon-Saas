import React, { useState, useRef } from 'react';
import { Camera, User, Loader2, Pencil, Save, X } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { Input, Select, TextArea } from '../../../components/FormElements';
import { useStaffPhotoUpload } from '../hooks/useStaffPhotoUpload';
import { useToast } from '../../../context/ToastContext';
import { StaffAvatar } from '../../../components/StaffAvatar';

interface ProfileIdentityCardProps {
  staff: StaffMember;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
}

export const ProfileIdentityCard: React.FC<ProfileIdentityCardProps> = ({ staff, onSave, isSaving }) => {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<StaffMember>>({});
  const { uploadPhoto, isUploading: isUploadingPhoto } = useStaffPhotoUpload();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | undefined>(undefined);
  const displayPhoto = localPhotoUrl ?? staff.photoUrl;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadPhoto(staff.id, file);
    if (url) setLocalPhotoUrl(url);
    e.target.value = '';
  };

  const startEdit = () => {
    setDraft({
      firstName: staff.firstName,
      lastName: staff.lastName,
      role: staff.role,
      birthDate: staff.birthDate,
      address: staff.address,
      bio: staff.bio,
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

  const roleColors: Record<string, string> = {
    Manager: 'bg-purple-100 text-purple-700 border-purple-200',
    Stylist: 'bg-violet-100 text-violet-700 border-violet-200',
    Assistant: 'bg-blue-100 text-blue-700 border-blue-200',
    Receptionist: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      {/* Header with edit toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Identité</h3>
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
        <div className="space-y-4">
          {/* Photo */}
          <div className="flex justify-center">
            <div
              className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden group cursor-pointer"
              onClick={() => photoInputRef.current?.click()}
            >
              {displayPhoto ? (
                <img src={displayPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-slate-400" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingPhoto ? <Loader2 className="text-white animate-spin" size={18} /> : <Camera className="text-white" size={18} />}
              </div>
            </div>
          </div>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
          <Input label="Prénom" value={draft.firstName ?? ''} onChange={e => setDraft({ ...draft, firstName: e.target.value })} />
          <Input label="Nom" value={draft.lastName ?? ''} onChange={e => setDraft({ ...draft, lastName: e.target.value })} />
          <Select
            label="Rôle"
            value={draft.role ?? ''}
            onChange={val => setDraft({ ...draft, role: val as StaffMember['role'] })}
            options={[
              { value: 'Manager', label: 'Manager' },
              { value: 'Stylist', label: 'Styliste' },
              { value: 'Assistant', label: 'Assistant(e)' },
              { value: 'Receptionist', label: 'Réceptionniste' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de naissance</label>
            <input
              type="date"
              className="w-full bg-white border border-slate-300 rounded-lg text-sm shadow-sm px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              value={draft.birthDate ?? ''}
              onChange={e => setDraft({ ...draft, birthDate: e.target.value })}
            />
          </div>
          <Input label="Adresse" value={draft.address ?? ''} onChange={e => setDraft({ ...draft, address: e.target.value })} />
          <TextArea label="Biographie" rows={3} value={draft.bio ?? ''} onChange={e => setDraft({ ...draft, bio: e.target.value })} placeholder="Expérience, spécialités..." />
        </div>
      ) : (
        <>
          {/* Profile card — read mode */}
          <div className="flex flex-col items-center text-center">
            <div
              className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden relative group cursor-pointer mb-3"
              onClick={() => photoInputRef.current?.click()}
            >
              {displayPhoto ? (
                <img src={displayPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <StaffAvatar firstName={staff.firstName} lastName={staff.lastName} size={80} />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingPhoto ? <Loader2 className="text-white animate-spin" size={18} /> : <Camera className="text-white" size={18} />}
              </div>
            </div>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
            <h2 className="text-lg font-bold text-slate-900">{staff.firstName} {staff.lastName}</h2>
            <span className={`mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleColors[staff.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {staff.role}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <InfoRow label="Date de naissance" value={staff.birthDate ? new Date(staff.birthDate).toLocaleDateString('fr-FR') : undefined} />
            <InfoRow label="Adresse" value={staff.address} />
            {staff.bio && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Biographie</p>
                <p className="text-sm text-slate-700 leading-relaxed">{staff.bio}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value || '—'}</span>
    </div>
  );
}
