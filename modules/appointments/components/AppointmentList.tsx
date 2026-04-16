import { CalendarDays, List, Plus, Search, Trash2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { ViewToggle } from '../../../components/ViewToggle';
import { useViewMode } from '../../../hooks/useViewMode';
import {
  type Appointment,
  AppointmentStatus,
  type Service,
  type ServiceCategory,
  type StaffMember,
} from '../../../types';
import { AppointmentCardList } from './AppointmentCard';
import { AppointmentTable } from './AppointmentTable';
import { CalendarView } from './CalendarView';

interface AppointmentListProps {
  appointments: Appointment[];
  allAppointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  allStaff: StaffMember[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  onAdd: () => void;
  onDetails: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: AppointmentStatus) => void;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  allAppointments,
  serviceCategories,
  services,
  allStaff,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAdd,
  onDetails,
  onEdit,
  onDelete,
  onStatusChange,
  showDeleted,
  onToggleDeleted,
}) => {
  const { viewMode, setViewMode } = useViewMode('appointments');
  const [mode, setMode] = useState<'list' | 'calendar'>('list');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Rendez-vous</h1>
          {showDeleted && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <Trash2 size={12} />
              Supprimés
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onToggleDeleted && (
            <button
              onClick={onToggleDeleted}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                showDeleted
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {showDeleted ? 'Voir les actifs' : 'Voir les supprimés'}
            </button>
          )}
          {!showDeleted && (
            <>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === 'list'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <List size={14} />
                  Liste
                </button>
                <button
                  onClick={() => setMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-l border-slate-300 ${
                    mode === 'calendar'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CalendarDays size={14} />
                  Calendrier
                </button>
              </div>
              <button
                onClick={onAdd}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
              >
                <Plus size={16} />
                Nouveau RDV
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'calendar' && !showDeleted ? (
        <CalendarView
          allAppointments={allAppointments}
          serviceCategories={serviceCategories}
          services={services}
          allStaff={allStaff}
          onViewDetails={onDetails}
          onEdit={onEdit ?? (() => {})}
        />
      ) : (
        <div
          className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${showDeleted ? 'opacity-80' : ''}`}
        >
          <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm shadow-sm cursor-pointer"
            >
              <option value="ALL">Tous les statuts</option>
              <option value={AppointmentStatus.SCHEDULED}>Planifié</option>
              <option value={AppointmentStatus.IN_PROGRESS}>En cours</option>
              <option value={AppointmentStatus.COMPLETED}>Terminé</option>
              <option value={AppointmentStatus.CANCELLED}>Annulé</option>
            </select>
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === 'table' ? (
            <AppointmentTable
              appointments={appointments}
              team={allStaff}
              services={services}
              categories={serviceCategories}
              onDetails={onDetails}
              onEdit={showDeleted ? undefined : onEdit}
              onDelete={showDeleted ? undefined : onDelete}
              onStatusChange={showDeleted ? undefined : onStatusChange}
            />
          ) : (
            <AppointmentCardList
              appointments={appointments}
              onDetails={onDetails}
              onDelete={showDeleted ? undefined : onDelete}
            />
          )}
        </div>
      )}
    </div>
  );
};
