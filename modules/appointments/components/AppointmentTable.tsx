
import React from 'react';
import { Pencil, Trash2, User } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';
import { StatusBadge } from './StatusBadge';

interface AppointmentTableProps {
  appointments: Appointment[];
  onDetails: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const AppointmentTable: React.FC<AppointmentTableProps> = ({ appointments, onDetails, onEdit, onDelete }) => {
  if (appointments.length === 0) {
    return <EmptyState title="Aucun rendez-vous" description="Aucun rendez-vous ne correspond aux filtres." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Date & Heure</th>
            <th className="px-6 py-3">Client</th>
            <th className="px-6 py-3">Service & Staff</th>
            <th className="px-6 py-3">Statut</th>
            <th className="px-6 py-3 hidden md:table-cell">Prix</th>
            <th className="px-6 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {appointments.map((appt) => {
            const date = new Date(appt.date);
            return (
              <tr key={appt.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onDetails(appt.id)}>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 capitalize text-sm">
                      {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs text-slate-500">
                      {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="font-medium text-slate-900 text-sm">{appt.clientName}</div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col gap-1">
                     <div className="text-sm font-medium text-slate-800">{appt.serviceName}</div>
                     <div className="text-xs text-slate-500 flex items-center gap-1">
                       <User size={12} /> {appt.staffName}
                     </div>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <StatusBadge status={appt.status} />
                </td>
                <td className="px-6 py-4 align-top text-sm font-medium text-slate-900 hidden md:table-cell">
                  {formatPrice(appt.price)}
                </td>
                <td className="px-6 py-4 align-top text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(appt.id); }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-md hover:bg-slate-100"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(appt.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
