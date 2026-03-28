import React from 'react';
import type { AppointmentStatus } from '../../../types';
import InlineCalendar from './InlineCalendar';
import TimePicker from './TimePicker';
import ReminderToggle from './ReminderToggle';

interface SchedulingPanelProps {
  activeDate: string | null;
  activeHour: number | null;
  activeMinute: number;
  onDateChange: (date: string) => void;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  status: AppointmentStatus;
  onStatusChange: (status: AppointmentStatus) => void;
  reminderMinutes: number | null;
  onReminderChange: (minutes: number | null) => void;
  unavailableHours?: Set<number>;
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string; color: string }[] = [
  { value: 'SCHEDULED' as AppointmentStatus, label: 'Planifié', color: 'bg-blue-500' },
  { value: 'COMPLETED' as AppointmentStatus, label: 'Complété', color: 'bg-green-500' },
  { value: 'CANCELLED' as AppointmentStatus, label: 'Annulé', color: 'bg-red-500' },
  { value: 'NO_SHOW' as AppointmentStatus, label: 'Absent', color: 'bg-orange-500' },
];

export default function SchedulingPanel({
  activeDate,
  activeHour,
  activeMinute,
  onDateChange,
  onHourChange,
  onMinuteChange,
  status,
  onStatusChange,
  reminderMinutes,
  onReminderChange,
  unavailableHours,
}: SchedulingPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4">
        {/* Status */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Statut</div>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as AppointmentStatus)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:border-pink-400 focus:outline-none min-h-[44px] appearance-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Calendar */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Date *</div>
          <InlineCalendar value={activeDate} onChange={onDateChange} />
        </div>

        {/* Time Picker */}
        <div className="mb-4">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Heure *</div>
          <TimePicker
            hour={activeHour}
            minute={activeMinute}
            onHourChange={onHourChange}
            onMinuteChange={onMinuteChange}
            unavailableHours={unavailableHours}
          />
        </div>

        {/* Reminder */}
        <div>
          <ReminderToggle value={reminderMinutes} onChange={onReminderChange} />
        </div>
      </div>
    </div>
  );
}
