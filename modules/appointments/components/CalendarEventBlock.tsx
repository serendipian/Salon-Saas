import React from 'react';
import { Appointment, AppointmentStatus, ServiceCategory } from '../../../types';
import { getCategoryCalendarColors } from './calendarColors';

interface CalendarEventBlockProps {
  appointment: Appointment;
  category: ServiceCategory | undefined;
  style: React.CSSProperties;
  compact?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export const CalendarEventBlock: React.FC<CalendarEventBlockProps> = ({
  appointment,
  category,
  style,
  compact = false,
  onClick,
}) => {
  const isCompleted = appointment.status === AppointmentStatus.COMPLETED;
  const isCancelled = appointment.status === AppointmentStatus.CANCELLED;
  const colors = category ? getCategoryCalendarColors(category.color) : null;

  const startDate = new Date(appointment.date);
  const endDate = new Date(startDate.getTime() + appointment.durationMinutes * 60000);
  const timeRange = `${formatTime(startDate)} - ${formatTime(endDate)}`;

  if (compact) {
    return (
      <button
        onClick={onClick}
        style={style}
        className={`
          w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded truncate
          border-l-[3px] cursor-pointer transition-opacity
          ${isCompleted || isCancelled ? 'opacity-40 border-slate-300 bg-slate-50 text-slate-500' : `${colors?.border ?? 'border-slate-400'} ${colors?.bg ?? 'bg-slate-50'} ${colors?.text ?? 'text-slate-800'}`}
          hover:opacity-80
        `}
      >
        <span className="font-medium">{formatTime(startDate)}</span>{' '}
        <span>{appointment.serviceName}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={style}
      className={`
        absolute left-0.5 right-0.5 rounded-md px-2 py-1 overflow-hidden cursor-pointer
        border-l-[3px] transition-opacity
        ${isCompleted || isCancelled ? 'opacity-40 border-slate-300 bg-slate-50 text-slate-500' : `${colors?.border ?? 'border-slate-400'} ${colors?.bg ?? 'bg-slate-50'} ${colors?.text ?? 'text-slate-800'}`}
        hover:opacity-80
      `}
    >
      <div className="text-xs font-semibold truncate">{appointment.serviceName}</div>
      <div className="text-[11px] opacity-75 truncate">{timeRange}</div>
    </button>
  );
};
