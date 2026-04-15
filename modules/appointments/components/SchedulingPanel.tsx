
import type { AppointmentStatus } from '../../../types';
import InlineCalendar from './InlineCalendar';
import ReminderToggle from './ReminderToggle';
import TimePicker from './TimePicker';

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
  hideStatus?: boolean;
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string; color: string }[] = [
  { value: 'SCHEDULED' as AppointmentStatus, label: 'Planifié', color: 'bg-blue-500' },
  { value: 'IN_PROGRESS' as AppointmentStatus, label: 'En cours', color: 'bg-violet-500' },
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
  hideStatus,
}: SchedulingPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-5 space-y-5">
        {/* Status */}
        {!hideStatus && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">Statut</div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onStatusChange(opt.value)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                    status === opt.value
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calendar */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Date *</div>
          <InlineCalendar value={activeDate} onChange={onDateChange} />
        </div>

        {/* Time Picker */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Heure *</div>
          <TimePicker
            hour={activeHour}
            minute={activeMinute}
            onHourChange={onHourChange}
            onMinuteChange={onMinuteChange}
            unavailableHours={unavailableHours}
            dateSelected={activeDate !== null}
          />
        </div>

        {/* Reminder */}
        <ReminderToggle value={reminderMinutes} onChange={onReminderChange} />
      </div>
    </div>
  );
}
