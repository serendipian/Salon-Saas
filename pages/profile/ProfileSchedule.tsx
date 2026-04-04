import React from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Section } from '../../components/FormElements';
import type { StaffMember } from '../../types';
import type { WorkSchedule } from '../../types';

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const DAY_ORDER: (keyof WorkSchedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface ProfileScheduleProps {
  linkedStaff: StaffMember;
}

export const ProfileSchedule: React.FC<ProfileScheduleProps> = ({ linkedStaff }) => {
  const navigate = useNavigate();
  const schedule = linkedStaff.schedule;

  return (
    <Section
      title="Mon Planning"
      action={
        <button
          onClick={() => navigate('/calendar')}
          className="text-xs font-medium text-pink-600 hover:text-pink-700 flex items-center gap-1"
        >
          <Calendar size={14} />
          Voir mon agenda
        </button>
      }
    >
      {schedule ? (
        <div className="space-y-1.5">
          {DAY_ORDER.map((day) => {
            const d = schedule[day];
            return (
              <div key={day} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700 w-24">{DAY_LABELS[day]}</span>
                {d.isOpen ? (
                  <span className="text-sm text-slate-600">{d.start} — {d.end}</span>
                ) : (
                  <span className="text-sm text-slate-400 italic">Repos</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">Aucun planning défini. Contactez votre responsable.</p>
      )}
    </Section>
  );
};
