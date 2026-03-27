
import React from 'react';
import { AppointmentStatus } from '../../../types';

export const StatusBadge = ({ status }: { status: AppointmentStatus }) => {
  const styles = {
    [AppointmentStatus.SCHEDULED]: 'bg-blue-50 text-blue-700 border-blue-100',
    [AppointmentStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    [AppointmentStatus.CANCELLED]: 'bg-slate-100 text-slate-600 border-slate-200',
    [AppointmentStatus.NO_SHOW]: 'bg-orange-50 text-orange-700 border-orange-100',
  };

  const labels = {
    [AppointmentStatus.SCHEDULED]: 'Planifié',
    [AppointmentStatus.COMPLETED]: 'Terminé',
    [AppointmentStatus.CANCELLED]: 'Annulé',
    [AppointmentStatus.NO_SHOW]: 'No Show',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${styles[status]} flex items-center gap-1.5 w-fit shadow-sm`}>
      {labels[status]}
    </span>
  );
};
