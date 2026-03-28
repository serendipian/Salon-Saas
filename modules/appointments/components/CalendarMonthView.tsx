import React from 'react';
import { Appointment, ServiceCategory } from '../../../types';
import { CalendarEventBlock } from './CalendarEventBlock';

interface CalendarMonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: { id: string; categoryId: string }[];
  onEventClick: (appointment: Appointment, rect: DOMRect) => void;
  onDateClick: (date: Date) => void;
}

const DAYS_HEADER = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const MAX_VISIBLE_EVENTS = 3;

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

interface MonthCell {
  date: Date;
  isCurrentMonth: boolean;
}

function getMonthGrid(year: number, month: number): MonthCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: MonthCell[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ date: d, isCurrentMonth: false });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  while (cells.length < 42) {
    const d = new Date(year, month + 1, cells.length - startOffset - lastDay.getDate() + 1);
    cells.push({ date: d, isCurrentMonth: false });
  }

  return cells;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentDate,
  appointments,
  serviceCategories,
  services,
  onEventClick,
  onDateClick,
}) => {
  const cells = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  const categoryMap = new Map(serviceCategories.map(c => [c.id, c]));
  const serviceCatMap = new Map(services.map(s => [s.id, s.categoryId]));

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 sticky top-0 bg-white z-10">
        {DAYS_HEADER.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-semibold uppercase ${
              i === 5 ? 'text-pink-500' : 'text-slate-500'
            } ${i > 0 ? 'border-l border-slate-100' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const today = isToday(cell.date);
          const dayAppts = appointments
            .filter(a => isSameDay(new Date(a.date), cell.date))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const visible = dayAppts.slice(0, MAX_VISIBLE_EVENTS);
          const overflow = dayAppts.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={i}
              className={`min-h-[120px] p-1.5 border-t border-slate-100 ${
                i % 7 > 0 ? 'border-l border-slate-100' : ''
              } ${!cell.isCurrentMonth ? 'bg-slate-50/50' : ''}`}
            >
              <button
                onClick={() => onDateClick(cell.date)}
                className="mb-1"
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
                    today
                      ? 'bg-pink-500 text-white font-bold'
                      : cell.isCurrentMonth
                        ? 'text-slate-900 font-medium hover:bg-slate-100'
                        : 'text-slate-400'
                  }`}
                >
                  {cell.date.getDate()}
                </span>
              </button>

              <div className="space-y-0.5">
                {visible.map(appt => {
                  const catId = serviceCatMap.get(appt.serviceId);
                  const category = catId ? categoryMap.get(catId) : undefined;
                  return (
                    <CalendarEventBlock
                      key={appt.id}
                      appointment={appt}
                      category={category}
                      compact
                      style={{}}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        onEventClick(appt, rect);
                      }}
                    />
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => onDateClick(cell.date)}
                    className="text-[11px] text-pink-500 font-medium pl-1.5 hover:underline"
                  >
                    +{overflow} de plus
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
