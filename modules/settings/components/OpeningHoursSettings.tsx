
import React, { useState } from 'react';
import { ArrowLeft, Save, Clock } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { WorkScheduleEditor } from '../../../components/WorkScheduleEditor';
import { Section } from '../../../components/FormElements';
import { WorkSchedule } from '../../../types';

// Default fallback if not set
const DEFAULT_SCHEDULE: WorkSchedule = {
  monday: { isOpen: true, start: '09:00', end: '19:00' },
  tuesday: { isOpen: true, start: '09:00', end: '19:00' },
  wednesday: { isOpen: true, start: '09:00', end: '19:00' },
  thursday: { isOpen: true, start: '09:00', end: '19:00' },
  friday: { isOpen: true, start: '09:00', end: '19:00' },
  saturday: { isOpen: true, start: '10:00', end: '18:00' },
  sunday: { isOpen: false, start: '09:00', end: '18:00' },
};

export const OpeningHoursSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { salonSettings, updateSalonSettings } = useSettings();
  const [schedule, setSchedule] = useState<WorkSchedule>(salonSettings.schedule || DEFAULT_SCHEDULE);

  const handleSave = () => {
    updateSalonSettings({ ...salonSettings, schedule });
    onBack();
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 w-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Horaires d'ouverture</h1>
        <div className="ml-auto">
           <button 
             onClick={handleSave}
             className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
           >
             <Save size={16} />
             Enregistrer
           </button>
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Heures d'ouverture du salon">
           <div className="flex items-start gap-6 mb-4">
              <div className="w-16 h-16 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                 <Clock size={24} />
              </div>
              <div className="flex-1 text-sm text-slate-500">
                 <p>Configurez les horaires d'ouverture de votre établissement.</p>
                 <p className="mt-1">Ces horaires seront utilisés pour la prise de rendez-vous en ligne et la gestion de l'agenda.</p>
              </div>
           </div>
           
           <WorkScheduleEditor value={schedule} onChange={setSchedule} />
        </Section>
      </div>
    </div>
  );
};
