import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

interface InlineCalendarProps {
  value: string | null;
  onChange: (date: string) => void;
  disabledDates?: Set<string>;
}

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
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

  const initial = value ? new Date(`${value}T00:00:00`) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const grid = useMemo(() => getDaysGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex justify-between items-center mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
        >
          <ChevronLeft size={16} className="text-slate-500" />
        </button>
        <span className="text-slate-900 text-sm font-semibold">
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
        >
          <ChevronRight size={16} className="text-slate-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DAYS_FR.map((d) => (
          <span key={d} className="text-slate-400 text-[10px] font-medium py-1.5">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
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
                text-xs p-2 rounded-lg transition-all font-medium
                ${
                  isSelected
                    ? 'bg-blue-500 text-white shadow-sm'
                    : isToday
                      ? 'text-blue-600 ring-1 ring-blue-400 bg-blue-50'
                      : isPast
                        ? 'text-slate-300'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                }
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
