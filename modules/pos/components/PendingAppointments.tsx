import { AlertTriangle, Calendar, Clock, Filter, User } from 'lucide-react';
import type React from 'react';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { formatName, formatPrice } from '../../../lib/format';
import type { Appointment } from '../../../types';
import { AppointmentStatus } from '../../../types';

interface PendingAppointmentsProps {
  groups: Appointment[][];
  onImport: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
  filtersActive: boolean;
  onResetFilters: () => void;
}

export const PendingAppointments: React.FC<PendingAppointmentsProps> = ({
  groups,
  onImport,
  linkedAppointmentId,
  filtersActive,
  onResetFilters,
}) => {
  const { isMobile } = useMediaQuery();

  if (groups.length === 0) {
    if (filtersActive) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Filter size={48} strokeWidth={1} className="mb-4 opacity-50" />
          <p className="font-medium text-sm">Aucun rendez-vous ne correspond aux filtres</p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Réinitialiser les filtres
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Calendar size={48} strokeWidth={1} className="mb-4 opacity-50" />
        <p className="font-medium text-sm">Aucun rendez-vous en attente</p>
        <p className="text-xs mt-1">Les rendez-vous confirmés du jour apparaîtront ici</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-3'}`}>
      {groups.map((groupAppts) => {
        const primary = groupAppts[0];
        const groupKey = primary.groupId ?? primary.id;
        // Same-day overdue: scheduled time has passed, status still SCHEDULED.
        // Past-day overdues are excluded upstream, so this only fires within today.
        const isOverdue =
          primary.status === AppointmentStatus.SCHEDULED && new Date(primary.date) < now;
        const isLinked = groupAppts.some((a) => a.id === linkedAppointmentId);
        const totalPrice = groupAppts.reduce((sum, a) => sum + a.price, 0);

        return (
          <button
            type="button"
            key={groupKey}
            onClick={() => onImport(primary)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              isLinked
                ? 'border-green-400 bg-green-50 hover:border-green-500 hover:shadow-md'
                : isOverdue
                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400 hover:shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-md'
            }`}
          >
            {isOverdue && (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold mb-2">
                <AlertTriangle size={12} />
                <span>En retard</span>
              </div>
            )}

            {isLinked && (
              <div className="text-xs font-semibold text-green-600 mb-2">
                Dans le panier · cliquer pour retirer
              </div>
            )}

            <div className="font-semibold text-slate-900 text-sm mb-1">
              {formatName(primary.clientName) || (
                <span className="text-slate-400 italic">Client de passage</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
              <Clock size={12} />
              <span>
                {new Date(primary.date).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="space-y-1.5 mb-3">
              {groupAppts.map((appt) => (
                <div key={appt.id} className="flex justify-between items-center text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-700 font-medium truncate block">
                      {appt.serviceName}
                    </span>
                    {appt.variantName && <span className="text-slate-400">{appt.variantName}</span>}
                  </div>
                  <span className="text-slate-600 font-medium ml-2 shrink-0">
                    {formatPrice(appt.price)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User size={12} />
                <span className="truncate max-w-[120px]">
                  {(() => {
                    const names = [...new Set(groupAppts.map((a) => a.staffName).filter(Boolean))];
                    return names.length > 0 ? names.join(', ') : 'Non attribué';
                  })()}
                </span>
              </div>
              <span className="font-bold text-slate-900 text-sm">{formatPrice(totalPrice)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
