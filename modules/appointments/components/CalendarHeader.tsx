import { ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import type { CalendarViewMode } from './useCalendar';

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
}

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

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function formatTitle(date: Date, viewMode: CalendarViewMode): string {
  if (viewMode === 'day') {
    return `${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (viewMode === 'week') {
    const { start, end } = getWeekRange(date);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${MONTHS_FR[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${MONTHS_FR[start.getMonth()]} ${start.getDate()} - ${MONTHS_FR[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

const VIEW_MODES: { key: CalendarViewMode; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
];

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewMode,
  onViewModeChange,
  onToday,
  onPrev,
  onNext,
}) => {
  return (
    <div className="py-2.5 px-3 sm:py-3 sm:px-4 border-b border-slate-200 bg-white">
      {/* Mobile: title on its own row, centered */}
      <h2 className="md:hidden text-sm font-semibold text-slate-900 text-center mb-2 capitalize">
        {formatTitle(currentDate, viewMode)}
      </h2>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden shrink-0">
          <button
            onClick={onPrev}
            className="h-9 w-9 sm:w-auto sm:px-2 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors border-r border-slate-300"
            aria-label="Précédent"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onToday}
            className="h-9 px-3 text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors"
          >
            Aujourd'hui
          </button>
          <button
            onClick={onNext}
            className="h-9 w-9 sm:w-auto sm:px-2 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors border-l border-slate-300"
            aria-label="Suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Desktop: title in center */}
        <h2 className="hidden md:block text-lg font-semibold text-slate-900 truncate">
          {formatTitle(currentDate, viewMode)}
        </h2>

        <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
          {VIEW_MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onViewModeChange(key)}
              className={`h-9 px-2.5 sm:px-3 text-sm font-medium transition-colors ${
                viewMode === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              } ${key !== 'day' ? 'border-l border-slate-300' : ''}`}
              aria-pressed={viewMode === key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
