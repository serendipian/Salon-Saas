
import React from 'react';
import { Plus, Search } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { AppointmentTable } from './AppointmentTable';
import { AppointmentCardList } from './AppointmentCard';

interface AppointmentListProps {
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  onAdd: () => void;
  onDetails: (id: string) => void;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAdd,
  onDetails
}) => {
  const { viewMode, setViewMode } = useViewMode('appointments');

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
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'table' ? (
          <AppointmentTable appointments={appointments} onDetails={onDetails} />
        ) : (
          <AppointmentCardList appointments={appointments} onDetails={onDetails} />
        )}
      </div>
    </div>
  );
};
