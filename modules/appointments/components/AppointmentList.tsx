
import React from 'react';
import { Plus, Search, ChevronRight, User } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { useAppContext } from '../../../context/AppContext';

interface AppointmentListProps {
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  onAdd: () => void;
  onDetails: (id: string) => void;
}

const StatusBadge = ({ status }: { status: AppointmentStatus }) => {
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

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAdd,
  onDetails
}) => {
  const { formatPrice } = useAppContext();

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Rendez-vous</h1>
        <button 
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau RDV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm shadow-sm cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value={AppointmentStatus.SCHEDULED}>Planifié</option>
            <option value={AppointmentStatus.COMPLETED}>Terminé</option>
            <option value={AppointmentStatus.CANCELLED}>Annulé</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-3">Date & Heure</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Service & Staff</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Prix</th>
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
                    <td className="px-6 py-4 align-top text-sm font-medium text-slate-900">
                      {formatPrice(appt.price)}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
