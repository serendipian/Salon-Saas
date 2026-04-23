import { Clock, Scissors, Tag, User } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { formatName, formatPrice } from '../../../lib/format';
import type { Appointment } from '../../../types';
import { StatusBadge } from './StatusBadge';

interface CalendarEventPopoverProps {
  appointment: Appointment;
  anchorRect: DOMRect;
  onClose: () => void;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
}

export const CalendarEventPopover: React.FC<CalendarEventPopoverProps> = ({
  appointment,
  anchorRect,
  onClose,
  onViewDetails,
  onEdit,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const showAbove = spaceBelow < 250;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(anchorRect.left, window.innerWidth - 300),
    zIndex: 50,
    ...(showAbove
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
  };

  const startDate = new Date(appointment.date);
  const endDate = new Date(startDate.getTime() + appointment.durationMinutes * 60000);
  const timeStr = `${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div
      ref={ref}
      style={style}
      className="w-[280px] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{appointment.serviceName}</h3>
          <StatusBadge status={appointment.status} />
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Clock size={14} className="text-slate-400 flex-shrink-0" />
          <span>{timeStr}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <User size={14} className="text-slate-400 flex-shrink-0" />
          <span>{formatName(appointment.clientName)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Scissors size={14} className="text-slate-400 flex-shrink-0" />
          <span>{appointment.staffName}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <Tag size={14} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium text-blue-600">{formatPrice(appointment.price)}</span>
        </div>
      </div>

      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => onViewDetails(appointment.id)}
          className="flex-1 px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
        >
          Voir détails
        </button>
        <button
          onClick={() => onEdit(appointment.id)}
          className="flex-1 px-3 py-1.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Modifier
        </button>
      </div>
    </div>
  );
};
