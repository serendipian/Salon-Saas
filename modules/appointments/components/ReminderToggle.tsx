import React from 'react';
import { Bell } from 'lucide-react';

interface ReminderToggleProps {
  value: number | null;
  onChange: (minutes: number | null) => void;
}

const REMINDER_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1h', value: 60 },
  { label: '3h', value: 180 },
  { label: '1 jour', value: 1440 },
  { label: '2 jours', value: 2880 },
];

export default function ReminderToggle({ value, onChange }: ReminderToggleProps) {
  const isOn = value !== null;
  const toggle = () => onChange(isOn ? null : 60);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Rappel</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`w-10 h-[22px] rounded-full relative transition-colors ${isOn ? 'bg-blue-500' : 'bg-slate-300'}`}
        >
          <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all shadow-sm ${isOn ? 'right-[2px]' : 'left-[2px]'}`} />
        </button>
      </div>
      {isOn && (
        <div className="flex gap-2 flex-wrap">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                value === opt.value
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
