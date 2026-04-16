import { CalendarDays, List, Plus, Search, Trash2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { FreshnessIndicator } from '../../../components/FreshnessIndicator';
import { ViewToggle } from '../../../components/ViewToggle';
import { useMediaQuery } from '../../../context/MediaQueryContext';
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
  freshnessUpdatedAt?: number;
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
  freshnessUpdatedAt,
}) => {
  const { viewMode, setViewMode } = useViewMode('appointments');
  const { isMobile } = useMediaQuery();
  const [mode, setMode] = useState<'list' | 'calendar'>('list');

  const archiveLabel = showDeleted ? 'Voir les actifs' : 'Voir les supprimés';
  const archiveLabelShort = showDeleted ? 'Actifs' : 'Corbeille';

  return (
    <div className="animate-in fade-in">
      {/* Header cluster — rows 1+2 are visually grouped, content below has its own rhythm */}
      <div className="space-y-3 mb-4 sm:mb-6">
        {/* Row 1 — title + primary CTA */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">Rendez-vous</h1>
            {freshnessUpdatedAt !== undefined && (
              <div className="hidden sm:block">
                <FreshnessIndicator updatedAt={freshnessUpdatedAt} />
              </div>
            )}
            {showDeleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700 shrink-0">
                <Trash2 size={11} />
                Supprimés
              </span>
            )}
          </div>
          {!showDeleted && (
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white h-10 px-3.5 sm:px-4 rounded-lg font-medium text-sm shadow-sm transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            >
              <Plus size={16} />
              <span>Nouveau RDV</span>
            </button>
          )}
        </div>

        {/* Row 2 — view mode + archive toggle */}
        {(onToggleDeleted || !showDeleted) && (
          <div className="flex items-center justify-between gap-2">
            {!showDeleted ? (
              <div className="inline-flex bg-slate-100/80 rounded-xl ring-1 ring-slate-200/60 p-0.5">
                <button
                  onClick={() => setMode('list')}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    mode === 'list'
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  aria-pressed={mode === 'list'}
                >
                  <List size={14} />
                  Liste
                </button>
                <button
                  onClick={() => setMode('calendar')}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    mode === 'calendar'
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  aria-pressed={mode === 'calendar'}
                >
                  <CalendarDays size={14} />
                  Calendrier
                </button>
              </div>
            ) : (
              <span aria-hidden className="min-w-0" />
            )}
            {onToggleDeleted && (
              <button
                onClick={onToggleDeleted}
                className={`inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus:outline-none ${
                  showDeleted
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-400'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-400'
                }`}
                aria-label={archiveLabel}
                title={archiveLabel}
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">{archiveLabel}</span>
                <span className="sm:hidden">{archiveLabelShort}</span>
              </button>
            )}
          </div>
        )}
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
          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 sm:gap-3 bg-white">
            <div className="relative flex-1 sm:max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Rechercher..."
                className="w-full h-10 pl-9 pr-4 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="flex-1 sm:flex-none h-10 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm shadow-sm cursor-pointer"
                aria-label="Filtrer par statut"
              >
                <option value="ALL">Tous les statuts</option>
                <option value={AppointmentStatus.SCHEDULED}>Planifié</option>
                <option value={AppointmentStatus.IN_PROGRESS}>En cours</option>
                <option value={AppointmentStatus.COMPLETED}>Terminé</option>
                <option value={AppointmentStatus.CANCELLED}>Annulé</option>
              </select>
              {!isMobile && <ViewToggle viewMode={viewMode} onChange={setViewMode} />}
            </div>
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
              onStatusChange={showDeleted ? undefined : onStatusChange}
            />
          )}
        </div>
      )}
    </div>
  );
};
