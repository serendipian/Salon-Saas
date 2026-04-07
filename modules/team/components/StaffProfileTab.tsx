import React, { useState, useRef } from 'react';
import { Pencil, Save, X, Check, ChevronDown, ChevronRight, AlertTriangle, Users, Loader2, Activity, Clock, Camera, User } from 'lucide-react';
import { StaffMember, WorkSchedule } from '../../../types';
import { Input, Select, TextArea } from '../../../components/FormElements';
import { WorkScheduleEditor } from '../../../components/WorkScheduleEditor';
import { useAuth } from '../../../context/AuthContext';
import { useServices } from '../../services/hooks/useServices';
import { useStaffClients } from '../hooks/useStaffClients';
import { useStaffActivity } from '../hooks/useStaffActivity';
import { formatPrice } from '../../../lib/format';
import { useStaffPhotoUpload } from '../hooks/useStaffPhotoUpload';

interface StaffProfileTabProps {
  staff: StaffMember;
  loadPii: () => Promise<Partial<StaffMember>>;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
  currencySymbol: string;
  onArchive: () => void;
  onSwitchTab?: (tab: string) => void;
}

type EditingSection = 'none' | 'personal' | 'contract' | 'pii';

// --- Read-only field display ---
const Field: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <div>
    <dt className="text-sm text-slate-500">{label}</dt>
    <dd className="text-sm text-slate-900 mt-0.5">{value || '—'}</dd>
  </div>
);

const SectionHeader: React.FC<{
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

// --- Day label mapping for schedule display ---
const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const ORDERED_DAYS: (keyof WorkSchedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const CONTRACT_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  Freelance: 'Freelance',
  Apprentissage: 'Apprentissage',
  Stage: 'Stage',
};

export const StaffProfileTab: React.FC<StaffProfileTabProps> = ({
  staff,
  loadPii,
  onSave,
  isSaving,
  currencySymbol,
  onArchive,
  onSwitchTab,
}) => {
  const { role } = useAuth();
  const { serviceCategories } = useServices();
  const { clients, isLoading: clientsLoading } = useStaffClients(staff.id);
  const { events: recentEvents, isLoading: activityLoading } = useStaffActivity(staff.id);

  const [editing, setEditing] = useState<EditingSection>('none');
  const [draft, setDraft] = useState<Partial<StaffMember>>({});
  const [piiLoaded, setPiiLoaded] = useState(false);
  const [piiLoading, setPiiLoading] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
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

  const canSeePii = role === 'owner' || role === 'manager';

  // --- Edit helpers ---
  const startEdit = (section: EditingSection) => {
    if (section === 'personal') {
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
    } else if (section === 'contract') {
      setDraft({
        contractType: staff.contractType,
        startDate: staff.startDate,
        endDate: staff.endDate,
        weeklyHours: staff.weeklyHours,
        skills: [...staff.skills],
        schedule: { ...staff.schedule },
      });
    }
    setEditing(section);
  };

  const startEditPii = async () => {
    setPiiLoading(true);
    try {
      const piiData = await loadPii();
      setDraft({
        baseSalary: piiData.baseSalary ?? staff.baseSalary,
        iban: piiData.iban ?? staff.iban,
        socialSecurityNumber: piiData.socialSecurityNumber ?? staff.socialSecurityNumber,
      });
      setPiiLoaded(true);
      setEditing('pii');
    } finally {
      setPiiLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditing('none');
    setDraft({});
  };

  const saveSection = async () => {
    await onSave(draft);
    setEditing('none');
    setDraft({});
  };

  // --- Skills helpers ---
  const getCategoryName = (id: string) => {
    const cat = serviceCategories.find(c => c.id === id);
    return cat?.name ?? id;
  };

  const toggleSkill = (categoryId: string) => {
    setDraft(prev => {
      const current = (prev.skills as string[]) || [];
      const has = current.includes(categoryId);
      return {
        ...prev,
        skills: has ? current.filter(id => id !== categoryId) : [...current, categoryId],
      };
    });
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      {/* ===== Section 1: Informations personnelles ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <SectionHeader
          title="Informations personnelles"
          editing={editing === 'personal'}
          onEdit={() => startEdit('personal')}
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

        {editing === 'personal' ? (
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

      {/* ===== Section 2: Contrat & Competences ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <SectionHeader
          title="Contrat & Competences"
          editing={editing === 'contract'}
          onEdit={() => startEdit('contract')}
          onSave={saveSection}
          onCancel={cancelEdit}
          isSaving={isSaving}
        />

        {editing === 'contract' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Type de contrat"
                value={draft.contractType ?? ''}
                onChange={val => setDraft({ ...draft, contractType: val as StaffMember['contractType'] })}
                options={[
                  { value: 'CDI', label: 'CDI' },
                  { value: 'CDD', label: 'CDD' },
                  { value: 'Freelance', label: 'Freelance' },
                  { value: 'Apprentissage', label: 'Apprentissage' },
                  { value: 'Stage', label: 'Stage' },
                ]}
              />
              <Input
                label="Heures / semaine"
                type="number"
                value={draft.weeklyHours ?? ''}
                onChange={e => setDraft({ ...draft, weeklyHours: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de debut</label>
                <input
                  type="date"
                  className="w-full bg-white border border-slate-300 rounded-lg text-sm shadow-sm px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  value={draft.startDate ?? ''}
                  onChange={e => setDraft({ ...draft, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de fin</label>
                <input
                  type="date"
                  className="w-full bg-white border border-slate-300 rounded-lg text-sm shadow-sm px-3 py-2.5 min-h-[44px] focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  value={draft.endDate ?? ''}
                  onChange={e => setDraft({ ...draft, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Skills multi-select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Competences</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {serviceCategories.map(category => {
                  const isSelected = ((draft.skills as string[]) || []).includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleSkill(category.id)}
                      className={`
                        flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all
                        ${isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : category.color.split(' ')[0]}`} />
                        {category.name}
                      </div>
                      {isSelected && <Check size={14} />}
                    </button>
                  );
                })}
                {serviceCategories.length === 0 && (
                  <div className="col-span-full text-center text-slate-400 py-4 text-sm italic">
                    Aucune categorie de service configuree.
                  </div>
                )}
              </div>
            </div>

            {/* Schedule editor */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Horaires de travail</label>
              <WorkScheduleEditor
                value={(draft.schedule as WorkSchedule) ?? staff.schedule}
                onChange={schedule => setDraft({ ...draft, schedule })}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Type de contrat" value={staff.contractType ? CONTRACT_LABELS[staff.contractType] ?? staff.contractType : undefined} />
              <Field label="Heures / semaine" value={staff.weeklyHours != null ? `${staff.weeklyHours}h` : undefined} />
              <Field label="Date de debut" value={formatDate(staff.startDate)} />
              <Field label="Date de fin" value={staff.endDate ? formatDate(staff.endDate) : 'Non definie'} />
            </dl>

            {/* Skills read-only */}
            <div>
              <dt className="text-sm text-slate-500 mb-2">Competences</dt>
              <div className="flex flex-wrap gap-2">
                {staff.skills.length > 0 ? (
                  staff.skills.map(id => (
                    <span key={id} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                      {getCategoryName(id)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400 italic">Aucune competence assignee</span>
                )}
              </div>
            </div>

            {/* Schedule read-only */}
            <div>
              <dt className="text-sm text-slate-500 mb-2">Horaires de travail</dt>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ORDERED_DAYS.map(day => {
                  const d = staff.schedule[day];
                  return (
                    <div key={day} className="flex items-center justify-between text-sm py-1">
                      <span className={`font-medium ${d.isOpen ? 'text-slate-900' : 'text-slate-400'}`}>
                        {DAY_LABELS[day]}
                      </span>
                      <span className={d.isOpen ? 'text-slate-700' : 'text-slate-400'}>
                        {d.isOpen ? `${d.start} - ${d.end}` : 'Ferme'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Section 3: Donnees sensibles (PII) ===== */}
      {canSeePii && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <SectionHeader
            title="Donnees sensibles"
            editing={editing === 'pii'}
            onEdit={startEditPii}
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

          {editing === 'pii' ? (
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
      )}

      {/* ===== Section 4: Portfolio clients ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-5">Portfolio clients</h3>

        {clientsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Chargement...
          </div>
        ) : clients.length === 0 ? (
          <div className="flex items-center gap-3 text-slate-400">
            <Users size={20} />
            <span className="text-sm">Aucun client associé pour le moment.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="pb-2 font-medium text-slate-500">Client</th>
                  <th className="pb-2 font-medium text-slate-500 text-center">Visites</th>
                  <th className="pb-2 font-medium text-slate-500 text-right">Revenus</th>
                  <th className="pb-2 font-medium text-slate-500 text-right hidden sm:table-cell">Dernière visite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map(client => (
                  <tr key={client.clientId}>
                    <td className="py-2.5 text-slate-900 font-medium">
                      {client.clientFirstName} {client.clientLastName}
                    </td>
                    <td className="py-2.5 text-center text-slate-600">{client.visitCount}</td>
                    <td className="py-2.5 text-right text-slate-900 font-medium">
                      {formatPrice(client.totalRevenue)}
                    </td>
                    <td className="py-2.5 text-right text-slate-500 hidden sm:table-cell">
                      {client.lastVisit ? new Date(client.lastVisit).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== Section 5: Activité récente ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-5">Activité récente</h3>

        {activityLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Chargement...
          </div>
        ) : recentEvents.length === 0 ? (
          <div className="flex items-center gap-3 text-slate-400">
            <Activity size={20} />
            <span className="text-sm">Aucune activité récente.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {recentEvents.slice(0, 10).map((event, i) => (
              <div key={`${event.eventType}-${event.eventDate}-${i}`} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5">
                  <Clock size={14} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900">{event.description}</p>
                  {event.clientName && (
                    <p className="text-slate-500 text-xs mt-0.5">Client : {event.clientName}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(event.eventDate).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
            {onSwitchTab && (
              <button
                type="button"
                onClick={() => onSwitchTab('activite')}
                className="text-sm text-pink-600 hover:text-pink-700 font-medium mt-2"
              >
                Voir toute l'activité →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===== Section 6: Zone de danger ===== */}
      <div className="bg-red-50/50 rounded-xl border border-red-200 p-6">
        <button
          type="button"
          onClick={() => setDangerOpen(!dangerOpen)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="text-lg font-semibold text-red-900">Zone de danger</h3>
          {dangerOpen ? <ChevronDown size={18} className="text-red-400" /> : <ChevronRight size={18} className="text-red-400" />}
        </button>

        {dangerOpen && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-red-700">
              L'archivage retire ce membre de l'equipe active. Cette action peut etre annulee par un administrateur.
            </p>

            {!showArchiveConfirm ? (
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <AlertTriangle size={16} />
                Archiver ce membre
              </button>
            ) : (
              <div className="bg-white border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-red-900">
                  Confirmer l'archivage de {staff.firstName} {staff.lastName} ?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onArchive();
                      setShowArchiveConfirm(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArchiveConfirm(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
