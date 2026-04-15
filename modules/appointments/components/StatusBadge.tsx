import { Check } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AppointmentStatus } from '../../../types';

const STATUS_CONFIG = {
  [AppointmentStatus.SCHEDULED]: {
    label: 'Planifié',
    style: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  [AppointmentStatus.IN_PROGRESS]: {
    label: 'En cours',
    style: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
  },
  [AppointmentStatus.COMPLETED]: {
    label: 'Terminé',
    style: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  [AppointmentStatus.CANCELLED]: {
    label: 'Annulé',
    style: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  [AppointmentStatus.NO_SHOW]: {
    label: 'No Show',
    style: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
  },
};

const ALL_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

interface StatusBadgeProps {
  status: AppointmentStatus;
  onStatusChange?: (status: AppointmentStatus) => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const config = STATUS_CONFIG[status];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!onStatusChange) {
    return (
      <span
        className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${config.style} flex items-center gap-1.5 w-fit`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${config.style} flex items-center gap-1.5 w-fit cursor-pointer hover:shadow-md transition-shadow`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </button>

      {isOpen && (
        <div
          className="absolute top-[calc(100%+4px)] left-0 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-black/5 py-1 min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ zIndex: 'var(--z-drawer-panel, 50)' }}
        >
          {ALL_STATUSES.map((s) => {
            const c = STATUS_CONFIG[s];
            const isCurrent = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCurrent) onStatusChange(s);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors ${
                  isCurrent ? 'bg-slate-50 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="flex-1">{c.label}</span>
                {isCurrent && <Check size={12} className="text-slate-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
