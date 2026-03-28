import React from 'react';

interface TimePickerProps {
  hour: number | null;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  unavailableHours?: Set<number>;
}

const MORNING_HOURS = [
  { value: 9, label: '9', period: 'AM' },
  { value: 10, label: '10', period: 'AM' },
  { value: 11, label: '11', period: 'AM' },
  { value: 12, label: '12', period: 'PM' },
  { value: 13, label: '1', period: 'PM' },
  { value: 14, label: '2', period: 'PM' },
];

const AFTERNOON_HOURS = [
  { value: 15, label: '3', period: 'PM' },
  { value: 16, label: '4', period: 'PM' },
  { value: 17, label: '5', period: 'PM' },
  { value: 18, label: '6', period: 'PM' },
  { value: 19, label: '7', period: 'PM' },
  { value: 20, label: '8', period: 'PM' },
];

const MINUTES = [0, 15, 30, 45] as const;

export default function TimePicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  unavailableHours,
}: TimePickerProps) {
  const [isAM, setIsAM] = React.useState(hour === null || hour < 12);

  const renderHourButton = (h: { value: number; label: string; period: string }) => {
    const isUnavailable = unavailableHours?.has(h.value);
    const isSelected = h.value === hour;
    return (
      <button
        key={h.value}
        type="button"
        disabled={isUnavailable}
        onClick={() => onHourChange(h.value)}
        className={`
          rounded-md py-2 px-1 text-center transition-colors
          ${isSelected
            ? 'bg-pink-500 text-white'
            : isUnavailable
              ? 'bg-slate-800 border border-slate-700 text-slate-600 opacity-40 line-through cursor-not-allowed'
              : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 cursor-pointer'
          }
        `}
      >
        <span className={`text-xs font-medium ${isSelected ? 'font-semibold' : ''}`}>{h.label}</span>
        <span className={`text-[9px] ml-0.5 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>{h.period}</span>
      </button>
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg p-2.5">
      <div className="grid grid-cols-6 gap-1 mb-1">
        {MORNING_HOURS.map(renderHourButton)}
      </div>
      <div className="grid grid-cols-6 gap-1 mb-2">
        {AFTERNOON_HOURS.map(renderHourButton)}
      </div>
      <div className="border-t border-slate-700 mb-2" />
      <div className="grid grid-cols-6 gap-1">
        {MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMinuteChange(m)}
            className={`
              rounded-md py-2 px-1 text-center text-xs transition-colors
              ${m === minute
                ? 'bg-pink-500 text-white font-semibold'
                : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 cursor-pointer'
              }
            `}
          >
            :{String(m).padStart(2, '0')}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsAM(true)}
          className={`rounded-md py-2 px-1 text-center text-sm transition-colors ${
            isAM ? 'bg-pink-500' : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer'
          }`}
        >
          ☀️
        </button>
        <button
          type="button"
          onClick={() => setIsAM(false)}
          className={`rounded-md py-2 px-1 text-center text-sm transition-colors ${
            !isAM ? 'bg-pink-500' : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer'
          }`}
        >
          🌙
        </button>
      </div>
    </div>
  );
}
