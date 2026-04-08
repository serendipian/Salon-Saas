import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { StaffMember, WorkSchedule } from '../../../types';
import { Input, Select } from '../../../components/FormElements';
import { WorkScheduleEditor } from '../../../components/WorkScheduleEditor';
import { useServices } from '../../services/hooks/useServices';
import { Field, SectionHeader, DAY_LABELS, ORDERED_DAYS, CONTRACT_LABELS, formatDate } from './profile-shared';

interface ProfileContractSectionProps {
  staff: StaffMember;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
}

export const ProfileContractSection: React.FC<ProfileContractSectionProps> = ({ staff, onSave, isSaving }) => {
  const { serviceCategories } = useServices();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<StaffMember>>({});

  const startEdit = () => {
    setDraft({
      contractType: staff.contractType,
      startDate: staff.startDate,
      endDate: staff.endDate,
      weeklyHours: staff.weeklyHours,
      skills: [...staff.skills],
      schedule: { ...staff.schedule },
    });
    setEditing(true);
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SectionHeader
        title="Contrat & Competences"
        editing={editing}
        onEdit={startEdit}
        onSave={saveSection}
        onCancel={cancelEdit}
        isSaving={isSaving}
      />

      {editing ? (
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
  );
};
