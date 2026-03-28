import React, { useState, useMemo } from 'react';

interface InlineCalendarProps {
  value: string | null;
  onChange: (date: string) => void;
  disabledDates?: Set<string>;
}

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function getDaysGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function InlineCalendar({ value, onChange, disabledDates }: InlineCalendarProps) {
  const today = new Date();
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const initial = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const grid = useMemo(() => getDaysGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <button type="button" onClick={prevMonth} className="text-slate-400 hover:text-white p-1">◀</button>
        <span className="text-slate-200 text-sm font-semibold">{MONTHS_FR[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="text-slate-400 hover:text-white p-1">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAYS_FR.map((d) => (
          <span key={d} className="text-slate-500 text-[10px] font-semibold py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {grid.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} />;
          const dateStr = formatDateStr(viewYear, viewMonth, day);
          const isSelected = dateStr === value;
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const isDisabled = disabledDates?.has(dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              className={`
                text-xs p-1.5 rounded-md transition-colors
                ${isSelected ? 'bg-pink-500 text-white font-semibold'
                  : isToday ? 'text-pink-400 ring-1 ring-pink-500/50'
                  : isPast ? 'text-slate-600'
                  : 'text-slate-200 hover:bg-slate-800'}
                ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
