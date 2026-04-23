import { Trash2, User } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { formatPrice } from '../../../lib/format';
import type { Appointment, AppointmentStatus } from '../../../types';
import { groupByDayAndClient } from './groupAppointments';
import { StatusBadge } from './StatusBadge';

const ClientAvatar: React.FC<{ name: string }> = ({ name }) => {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
      : name.charAt(0).toUpperCase();

  return (
    <span
      className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-semibold text-xs"
      aria-label={name}
    >
      {initials || <User size={14} />}
    </span>
  );
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const formatDayLabel = (dayKey: string) => {
  const d = new Date(`${dayKey}T00:00:00`);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

interface GroupedCardProps {
  appointments: Appointment[];
  onDetails: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: AppointmentStatus) => void;
}

const AppointmentGroupedCard: React.FC<GroupedCardProps> = ({
  appointments,
  onDetails,
  onDelete,
  onStatusChange,
}) => {
  const isMulti = appointments.length > 1;
  const first = appointments[0];
  const last = appointments[appointments.length - 1];
  const totalPrice = appointments.reduce((sum, a) => sum + a.price, 0);
  const endTime = new Date(new Date(last.date).getTime() + (last.durationMinutes ?? 0) * 60_000);
  const timeRange = isMulti
    ? `${formatTime(first.date)} – ${endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : formatTime(first.date);

  const handleDeleteAll = () => {
    if (!onDelete) return;
    if (
      isMulti &&
      !window.confirm(
        `Supprimer les ${appointments.length} services de ${first.clientName || 'ce client'} ?`,
      )
    ) {
      return;
    }
    appointments.forEach((a) => onDelete(a.id));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-gradient-to-br from-slate-50/70 to-white border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ClientAvatar name={first.clientName || '?'} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 text-sm truncate">
                {first.clientName || '—'}
              </span>
              {isMulti && (
                <span
                  className="inline-flex items-center px-1.5 py-px rounded-md bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-[10px] font-bold tracking-wide shadow-sm shadow-blue-500/30 ring-1 ring-white/20 shrink-0"
                  title={`${appointments.length} services`}
                >
                  ×{appointments.length}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{timeRange}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-slate-900">{formatPrice(totalPrice)}</span>
          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteAll}
              className="p-1.5 -mr-1 text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus:outline-none"
              aria-label={isMulti ? 'Supprimer la visite' : 'Supprimer le rendez-vous'}
              title={isMulti ? 'Supprimer la visite' : 'Supprimer'}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-slate-100">
        {appointments.map((appt) => (
          <li key={appt.id} className="relative">
            <button
              type="button"
              onClick={() => onDetails(appt.id)}
              className="w-full px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 focus:outline-none transition-colors"
              aria-label={`Voir ${appt.serviceName} à ${formatTime(appt.date)}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                    {formatTime(appt.date)}
                  </span>
                  <span className="text-slate-700 truncate">{appt.serviceName || '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 min-w-0">
                    <User size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{appt.staffName || '—'}</span>
                  </span>
                  {appt.variantName && (
                    <span className="truncate text-slate-400">{appt.variantName}</span>
                  )}
                  {!isMulti && (
                    <span className="ml-auto font-medium text-slate-700 shrink-0">
                      {formatPrice(appt.price)}
                    </span>
                  )}
                </div>
              </div>
              <div
                className="flex flex-col items-end gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <StatusBadge
                  status={appt.status}
                  onStatusChange={onStatusChange ? (s) => onStatusChange(appt.id, s) : undefined}
                />
                {isMulti && onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(appt.id);
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 focus:outline-none"
                    aria-label={`Supprimer ${appt.serviceName}`}
                    title="Supprimer ce service"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                {appt.deletedAt && (
                  <span className="text-[10px] text-red-500 whitespace-nowrap">
                    Supprimé le{' '}
                    {new Date(appt.deletedAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface AppointmentCardListProps {
  appointments: Appointment[];
  onDetails: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: AppointmentStatus) => void;
}

export const AppointmentCardList: React.FC<AppointmentCardListProps> = ({
  appointments,
  onDetails,
  onDelete,
  onStatusChange,
}) => {
  const grouped = useMemo(() => groupByDayAndClient(appointments), [appointments]);

  if (appointments.length === 0) {
    return (
      <EmptyState
        title="Aucun rendez-vous"
        description="Aucun rendez-vous ne correspond aux filtres."
      />
    );
  }

  return (
    <div className="p-3 space-y-5 max-w-2xl mx-auto w-full">
      {grouped.map(({ dayKey, clientGroups }) => (
        <section key={dayKey} aria-label={formatDayLabel(dayKey)}>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider capitalize px-1 mb-2">
            {formatDayLabel(dayKey)}
          </h3>
          <div className="space-y-2.5">
            {clientGroups.map((group, idx) => (
              <AppointmentGroupedCard
                key={group[0].clientId || group[0].id || idx}
                appointments={group}
                onDetails={onDetails}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
