import React from 'react';

interface ReminderToggleProps {
  value: number | null;
  onChange: (minutes: number | null) => void;
}

const REMINDER_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1h avant', value: 60 },
  { label: '3h avant', value: 180 },
  { label: '1 jour', value: 1440 },
  { label: '2 jours', value: 2880 },
];

export default function ReminderToggle({ value, onChange }: ReminderToggleProps) {
  const isOn = value !== null;
  const toggle = () => onChange(isOn ? null : 60);

  return (
    <div>
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Rappel</span>
        <button
          type="button"
          onClick={toggle}
          className={`w-9 h-5 rounded-full relative transition-colors ${isOn ? 'bg-pink-500' : 'bg-slate-600'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${isOn ? 'right-0.5' : 'left-0.5'}`} />
        </button>
      </div>
      {isOn ? (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-full text-[11px] transition-colors ${
                value === opt.value
                  ? 'bg-pink-500 text-white font-medium'
                  : 'bg-slate-950 border border-slate-600 text-slate-300 hover:border-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-[11px] mt-1 italic">Activer pour configurer un rappel</p>
      )}
    </div>
  );
}
