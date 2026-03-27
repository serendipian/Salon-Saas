
import React from 'react';
import { Scissors, User } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

const StatusBadge = ({ status }: { status: AppointmentStatus }) => {
  const styles = {
    [AppointmentStatus.SCHEDULED]: 'bg-blue-50 text-blue-700 border-blue-100',
    [AppointmentStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    [AppointmentStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200',
    [AppointmentStatus.NO_SHOW]: 'bg-orange-50 text-orange-700 border-orange-100',
  };

  const labels = {
    [AppointmentStatus.SCHEDULED]: 'Planifie',
    [AppointmentStatus.COMPLETED]: 'Termine',
    [AppointmentStatus.CANCELLED]: 'Annule',
    [AppointmentStatus.NO_SHOW]: 'No Show',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${styles[status]} flex items-center gap-1.5 w-fit shadow-sm`}>
      {labels[status]}
    </span>
  );
};

interface AppointmentCardListProps {
  appointments: Appointment[];
  onDetails: (id: string) => void;
}

export const AppointmentCardList: React.FC<AppointmentCardListProps> = ({ appointments, onDetails }) => {
  if (appointments.length === 0) {
    return <EmptyState title="Aucun rendez-vous" description="Aucun rendez-vous ne correspond aux filtres." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {appointments.map((appt) => {
        const date = new Date(appt.date);
        return (
          <button
            key={appt.id}
            type="button"
            onClick={() => onDetails(appt.id)}
            aria-label={`Rendez-vous de ${appt.clientName} le ${date.toLocaleDateString('fr-FR')}`}
            className="bg-white rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus:outline-none"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-slate-900 text-sm">{appt.clientName}</div>
                <div className="text-xs text-slate-500 capitalize">
                  {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' '}
                  {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <StatusBadge status={appt.status} />
            </div>
            <div className="flex flex-col gap-1 mt-3">
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <Scissors size={12} className="text-slate-400" />
                <span>{appt.serviceName}</span>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <User size={12} className="text-slate-400" />
                <span>{appt.staffName}</span>
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-900">
              {formatPrice(appt.price)}
            </div>
          </button>
        );
      })}
    </div>
  );
};
