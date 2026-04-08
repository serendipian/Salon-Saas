import React, { useState, useRef } from 'react';
import { Camera, User, Loader2 } from 'lucide-react';
import type { StaffMember } from '../../../types';
import { Input, Select, TextArea } from '../../../components/FormElements';
import { useStaffPhotoUpload } from '../hooks/useStaffPhotoUpload';
import { useToast } from '../../../context/ToastContext';
import { Field, SectionHeader, formatDate } from './profile-shared';

interface ProfilePersonalSectionProps {
  staff: StaffMember;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
}

export const ProfilePersonalSection: React.FC<ProfilePersonalSectionProps> = ({ staff, onSave, isSaving }) => {
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
      email: staff.email,
      phone: staff.phone,
      birthDate: staff.birthDate,
      address: staff.address,
      bio: staff.bio,
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
      addToast({ type: 'error', message: 'Impossible de sauvegarder les informations personnelles' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader
        title="Informations personnelles"
        editing={editing}
        onEdit={startEdit}
        onSave={saveSection}
        onCancel={cancelEdit}
        isSaving={isSaving}
      />

      {/* Photo upload (always visible) */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden group cursor-pointer shrink-0"
          onClick={() => photoInputRef.current?.click()}
        >
          {displayPhoto ? (
            <img src={displayPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={24} className="text-slate-400" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploadingPhoto ? (
              <Loader2 className="text-white animate-spin" size={18} />
            ) : (
              <Camera className="text-white" size={18} />
            )}
          </div>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoChange}
        />
        <div>
          <div className="text-sm font-medium text-slate-800">{staff.firstName} {staff.lastName}</div>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-0.5"
          >
            {displayPhoto ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Prenom"
              value={draft.firstName ?? ''}
              onChange={e => setDraft({ ...draft, firstName: e.target.value })}
            />
            <Input
              label="Nom"
              value={draft.lastName ?? ''}
              onChange={e => setDraft({ ...draft, lastName: e.target.value })}
            />
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
            <Input
              label="Email"
              type="email"
              value={draft.email ?? ''}
              onChange={e => setDraft({ ...draft, email: e.target.value })}
            />
            <Input
              label="Telephone"
              type="tel"
              value={draft.phone ?? ''}
              onChange={e => setDraft({ ...draft, phone: e.target.value })}
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
            <Input
              label="Adresse"
              value={draft.address ?? ''}
              onChange={e => setDraft({ ...draft, address: e.target.value })}
            />
          </div>
          <TextArea
            label="Biographie"
            rows={3}
            value={draft.bio ?? ''}
            onChange={e => setDraft({ ...draft, bio: e.target.value })}
            placeholder="Experience, specialites..."
          />
          <div className="border-t border-slate-100 pt-4 mt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Contact d'urgence</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nom du contact"
                value={draft.emergencyContactName ?? ''}
                onChange={e => setDraft({ ...draft, emergencyContactName: e.target.value })}
              />
              <Input
                label="Relation"
                placeholder="Ex: Epoux"
                value={draft.emergencyContactRelation ?? ''}
                onChange={e => setDraft({ ...draft, emergencyContactRelation: e.target.value })}
              />
              <Input
                label="Telephone d'urgence"
                type="tel"
                value={draft.emergencyContactPhone ?? ''}
                onChange={e => setDraft({ ...draft, emergencyContactPhone: e.target.value })}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Prenom" value={staff.firstName} />
            <Field label="Nom" value={staff.lastName} />
            <Field label="Rôle" value={staff.role} />
            <Field label="Email" value={staff.email} />
            <Field label="Telephone" value={staff.phone} />
            <Field label="Date de naissance" value={formatDate(staff.birthDate)} />
            <Field label="Adresse" value={staff.address} />
          </dl>
          {staff.bio && (
            <div>
              <dt className="text-sm text-slate-500">Biographie</dt>
              <dd className="text-sm text-slate-900 mt-0.5">{staff.bio}</dd>
            </div>
          )}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Contact d'urgence</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom du contact" value={staff.emergencyContactName} />
              <Field label="Relation" value={staff.emergencyContactRelation} />
              <Field label="Telephone d'urgence" value={staff.emergencyContactPhone} />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
