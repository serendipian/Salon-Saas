import { Plus, Search, Trash2 } from 'lucide-react';
import type React from 'react';
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

interface AppointmentListProps {
  appointments: Appointment[];
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
  onRequestCancel?: (appointmentIds: string[]) => void;
  onStatusChange?: (id: string, status: AppointmentStatus) => void;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  freshnessUpdatedAt?: number;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
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
  onRequestCancel,
  onStatusChange,
  showDeleted,
  onToggleDeleted,
  freshnessUpdatedAt,
}) => {
  const { viewMode, setViewMode } = useViewMode('appointments');
  const { isMobile } = useMediaQuery();

  const archiveLabel = showDeleted ? 'Voir les actifs' : 'Voir les supprimés';
  const archiveLabelShort = showDeleted ? 'Actifs' : 'Corbeille';

  return (
    <div className="animate-in fade-in">
      {/* Header */}
      <div className="space-y-3 mb-4 sm:mb-6">
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
          <div className="flex items-center gap-2">
            {onToggleDeleted && (
              <button
                onClick={onToggleDeleted}
                className={`inline-flex items-center gap-1.5 h-10 px-2.5 sm:px-3 text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus:outline-none ${
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
        </div>
      </div>

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
            onRequestCancel={showDeleted ? undefined : onRequestCancel}
            onStatusChange={showDeleted ? undefined : onStatusChange}
          />
        ) : (
          <AppointmentCardList
            appointments={appointments}
            onDetails={onDetails}
            onRequestCancel={showDeleted ? undefined : onRequestCancel}
            onStatusChange={showDeleted ? undefined : onStatusChange}
          />
        )}
      </div>
    </div>
  );
};
