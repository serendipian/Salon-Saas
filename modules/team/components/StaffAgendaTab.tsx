import { Calendar, Clock, TrendingUp, User } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { formatName } from '../../../lib/format';
import type { StaffMember, WorkSchedule } from '../../../types';
import { useStaffAppointments } from '../hooks/useStaffAppointments';

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const DAY_ORDER: (keyof WorkSchedule)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

interface StaffAgendaTabProps {
  staff: StaffMember;
}

export const StaffAgendaTab: React.FC<StaffAgendaTabProps> = ({ staff }) => {
  const { upcoming, today, bookingRate, isLoading } = useStaffAppointments(
    staff.id,
    staff.schedule,
  );

  // Group upcoming appointments by day (excluding today)
  const todayStr = new Date().toDateString();
  const upcomingByDay = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const apt of upcoming) {
      const d = new Date(apt.date).toDateString();
      if (d === todayStr) continue;
      if (!groups[d]) groups[d] = [];
      groups[d].push(apt);
    }
    return Object.entries(groups).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
  }, [upcoming, todayStr]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Calendar className="w-4 h-4" />
            <span>Cette semaine</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{upcoming.length}</p>
          <p className="text-xs text-slate-500">rendez-vous</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Taux de réservation</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {bookingRate !== null ? `${bookingRate}%` : '—'}
          </p>
          <p className="text-xs text-slate-500">ce mois</p>
        </div>
      </div>

      {/* Today's appointments */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          Aujourd'hui
        </h3>
        {today.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun rendez-vous aujourd'hui</p>
        ) : (
          <div className="space-y-3">
            {today.map((apt: any) => (
              <AppointmentRow key={apt.id} appointment={apt} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming 7 days */}
      {upcomingByDay.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            Prochains jours
          </h3>
          <div className="space-y-5">
            {upcomingByDay.map(([dayStr, apts]) => (
              <div key={dayStr}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  {formatDayHeader(apts[0].date)}
                </p>
                <div className="space-y-2">
                  {apts.map((apt: any) => (
                    <AppointmentRow key={apt.id} appointment={apt} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly schedule */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Horaires de travail</h3>
        <div className="space-y-2">
          {DAY_ORDER.map((day) => {
            const slot = staff.schedule?.[day];
            return (
              <div key={day} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-slate-700 font-medium w-24">{DAY_LABELS[day]}</span>
                {slot?.isOpen ? (
                  <span className="text-sm text-slate-600">
                    {slot.start} — {slot.end}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400 italic">Fermé</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function AppointmentRow({ appointment }: { appointment: any }) {
  const statusMap: Record<string, { color: string; label: string }> = {
    COMPLETED: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Terminé' },
    CONFIRMED: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Confirmé' },
    NO_SHOW: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Absent' },
    CANCELLED: { color: 'bg-slate-50 text-slate-500 border-slate-200', label: 'Annulé' },
  };
  const status = statusMap[appointment.status] || {
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    label: 'Planifié',
  };
  const statusColor = status.color;
  const statusLabel = status.label;

  const clientName = appointment.clients
    ? `${formatName(appointment.clients.first_name)} ${formatName(appointment.clients.last_name)}`
    : 'Client inconnu';

  const serviceName = appointment.services?.name || '—';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
      <div className="text-sm font-mono font-medium text-slate-700 w-14 shrink-0">
        {formatTime(appointment.date)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 truncate">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {clientName}
        </div>
        <p className="text-xs text-slate-500 truncate">
          {serviceName} · {appointment.duration_minutes || '—'} min
        </p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>
        {statusLabel}
      </span>
    </div>
  );
}
