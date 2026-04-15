import React from 'react';
import { Clock, Copy, RefreshCw } from 'lucide-react';
import { WorkSchedule, WorkDay } from '../types';

interface WorkScheduleEditorProps {
  value: WorkSchedule;
  onChange: (schedule: WorkSchedule) => void;
}

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const ORDERED_DAYS: (keyof WorkSchedule)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const WorkScheduleEditor: React.FC<WorkScheduleEditorProps> = ({ value, onChange }) => {
  const handleChange = (day: keyof WorkSchedule, field: keyof WorkDay, val: string | boolean) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        [field]: val,
      },
    });
  };

  const copyMondayToWeekdays = () => {
    const monday = value.monday;
    const newSchedule = { ...value };
    (['tuesday', 'wednesday', 'thursday', 'friday'] as (keyof WorkSchedule)[]).forEach((day) => {
      newSchedule[day] = { ...monday };
    });
    onChange(newSchedule);
  };

  const copyMondayToAll = () => {
    const monday = value.monday;
    const newSchedule = { ...value };
    ORDERED_DAYS.forEach((day) => {
      if (day !== 'monday') newSchedule[day] = { ...monday };
    });
    onChange(newSchedule);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header / Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap gap-2 items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
          Configuration Hebdomadaire
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            className="text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-all shadow-sm min-h-[36px]"
            title="Copier les horaires de Lundi sur Mardi-Vendredi"
          >
            <Copy size={12} />
            <span>
              Lun <span className="text-slate-400">→</span> Ven
            </span>
          </button>
          <button
            type="button"
            onClick={copyMondayToAll}
            className="text-xs flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-medium bg-brand-50 hover:bg-brand-100 border border-brand-100 px-3 py-1.5 rounded-lg transition-all min-h-[36px]"
            title="Copier les horaires de Lundi sur toute la semaine"
          >
            <RefreshCw size={12} />
            <span>
              Lun <span className="text-brand-400">→</span> Tous
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="relative">
        {/* Fade gradient on right edge to signal scrollability */}
        <div
          className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden"
          style={{ zIndex: 1 }}
        />

        <div className="overflow-x-auto scroll-smooth" style={{ scrollSnapType: 'x mandatory' }}>
          <div className="min-w-[600px]">
            {/* Grid Header */}
            <div className="grid grid-cols-12 gap-4 p-3 bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-3 min-w-[64px]">Jour</div>
              <div
                className="col-span-3 text-center min-w-[120px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                Statut
              </div>
              <div className="col-span-6 min-w-[240px]" style={{ scrollSnapAlign: 'start' }}>
                Plage Horaire
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {ORDERED_DAYS.map((day) => {
                const dayData = value[day];
                const isOpen = dayData.isOpen;

                return (
                  <div
                    key={day}
                    className={`
                      grid grid-cols-12 gap-4 p-4 items-center transition-all duration-200
                      ${isOpen ? 'bg-white' : 'bg-slate-50/30'}
                      group hover:bg-slate-50
                    `}
                  >
                    {/* Day Label */}
                    <div className="col-span-3 flex items-center gap-3 min-w-[64px]">
                      <div
                        className={`w-1 h-8 rounded-full transition-colors ${isOpen ? 'bg-slate-900' : 'bg-slate-300'}`}
                      ></div>
                      <span
                        className={`font-medium text-sm ${isOpen ? 'text-slate-900' : 'text-slate-400'}`}
                      >
                        {DAY_LABELS[day]}
                      </span>
                    </div>

                    {/* Toggle Switch */}
                    <div className="col-span-3 flex justify-center min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => handleChange(day, 'isOpen', !isOpen)}
                        className={`
                          group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2
                          ${isOpen ? 'bg-slate-900' : 'bg-slate-200 hover:bg-slate-300'}
                        `}
                        role="switch"
                        aria-checked={isOpen}
                      >
                        <span className="sr-only">Toggle status</span>
                        <span
                          className={`
                            pointer-events-none relative inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${isOpen ? 'translate-x-5' : 'translate-x-0'}
                          `}
                        >
                          <span
                            className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${isOpen ? 'opacity-0 duration-100 ease-out' : 'opacity-100 duration-200 ease-in'}`}
                            aria-hidden="true"
                          >
                            <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 12 12">
                              <path
                                d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span
                            className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${isOpen ? 'opacity-100 duration-200 ease-in' : 'opacity-0 duration-100 ease-out'}`}
                            aria-hidden="true"
                          >
                            <svg
                              className="h-3 w-3 text-slate-900"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    </div>

                    {/* Time Inputs or Closed Badge */}
                    <div className="col-span-6 min-w-[240px]">
                      {isOpen ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                              <Clock size={14} className="text-slate-400" />
                            </div>
                            <input
                              type="time"
                              value={dayData.start}
                              onChange={(e) => handleChange(day, 'start', e.target.value)}
                              className="block w-full pl-8 pr-2 py-1.5 text-sm text-center bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:border-slate-900 shadow-sm hover:border-slate-400 transition-colors min-h-[44px]"
                            />
                          </div>

                          <span className="text-slate-400 font-medium text-sm">à</span>

                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                              <Clock size={14} className="text-slate-400" />
                            </div>
                            <input
                              type="time"
                              value={dayData.end}
                              onChange={(e) => handleChange(day, 'end', e.target.value)}
                              className="block w-full pl-8 pr-2 py-1.5 text-sm text-center bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:border-slate-900 shadow-sm hover:border-slate-400 transition-colors min-h-[44px]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-full flex justify-center items-center h-[44px] animate-in zoom-in-95 duration-200">
                          <span className="inline-flex items-center justify-center px-4 py-1 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold uppercase tracking-widest border border-slate-200/60 shadow-sm select-none">
                            Fermé
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
