import { ArrowLeft, Clock, Loader2, Save } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Section } from '../../../components/FormElements';
import { WorkScheduleEditor } from '../../../components/WorkScheduleEditor';
import type { WorkSchedule } from '../../../types';
import { useSettings } from '../hooks/useSettings';

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

export const OpeningHoursSettings: React.FC = () => {
  const navigate = useNavigate();
  const { salonSettings, updateSalonSettings } = useSettings();
  const [schedule, setSchedule] = useState<WorkSchedule>(
    salonSettings.schedule || DEFAULT_SCHEDULE,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSchedule(salonSettings.schedule || DEFAULT_SCHEDULE);
  }, [salonSettings.schedule]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSalonSettings({ ...salonSettings, schedule });
      void navigate('/settings');
    } catch {
      // Error toast handled by mutation's onError
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 w-full">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Horaires d'ouverture</h1>
        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
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
              <p className="mt-1">
                Ces horaires seront utilisés pour la prise de rendez-vous en ligne et la gestion de
                l'agenda.
              </p>
            </div>
          </div>

          <WorkScheduleEditor value={schedule} onChange={setSchedule} />
        </Section>
      </div>
    </div>
  );
};
