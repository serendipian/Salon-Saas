
import React from 'react';
import { Plus, Search } from 'lucide-react';
import { StaffMember, Appointment } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { TeamTable } from './TeamTable';
import { TeamCard } from './TeamCard';

interface TeamListProps {
  team: StaffMember[];
  appointments: Appointment[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onSelect: (id: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
}

export const TeamList: React.FC<TeamListProps> = ({ team, appointments, searchTerm, onSearchChange, onAdd, onSelect, showArchived, onToggleArchived }) => {
  const { viewMode, setViewMode } = useViewMode('team');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
        <button
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nouveau Membre</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
        {viewMode === 'table' ? (
          <TeamTable team={team} appointments={appointments} onSelect={onSelect} />
        ) : (
          <TeamCard team={team} appointments={appointments} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
};
