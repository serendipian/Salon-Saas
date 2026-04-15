import { BarChart2, Plus, Search, Users } from 'lucide-react';
import type React from 'react';
import { ViewToggle } from '../../../components/ViewToggle';
import { useViewMode } from '../../../hooks/useViewMode';
import type { Appointment, ServiceCategory, StaffMember } from '../../../types';
import { TeamCard } from './TeamCard';
import { TeamTable } from './TeamTable';

type Tab = 'members' | 'performance';

interface TeamListProps {
  team: StaffMember[];
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onSelect: (id: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isLoading?: boolean;
  performanceContent?: React.ReactNode;
}

export const TeamList: React.FC<TeamListProps> = ({
  team,
  appointments,
  serviceCategories,
  searchTerm,
  onSearchChange,
  onAdd,
  onSelect,
  showArchived,
  onToggleArchived,
  activeTab,
  onTabChange,
  isLoading,
  performanceContent,
}) => {
  const { viewMode, setViewMode } = useViewMode('team');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => onTabChange('members')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'members'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={15} />
              Membres
            </button>
            <button
              onClick={() => onTabChange('performance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'performance'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 size={15} />
              Performance
            </button>
          </div>
          <button
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nouveau Membre</span>
          </button>
        </div>
      </div>

      {activeTab === 'performance' && performanceContent}

      {activeTab === 'members' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Filter Bar */}
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
                placeholder="Rechercher un membre..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={onToggleArchived}
              className={`text-sm px-3 py-1.5 rounded-lg whitespace-nowrap ${showArchived ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
            </button>
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            </div>
          ) : viewMode === 'table' ? (
            <TeamTable
              team={team}
              appointments={appointments}
              serviceCategories={serviceCategories}
              onSelect={onSelect}
            />
          ) : (
            <TeamCard
              team={team}
              appointments={appointments}
              serviceCategories={serviceCategories}
              onSelect={onSelect}
            />
          )}
        </div>
      )}
    </div>
  );
};
