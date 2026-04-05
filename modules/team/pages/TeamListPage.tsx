
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BarChart2 } from 'lucide-react';
import { TeamList } from '../components/TeamList';
import { TeamPerformance } from '../components/TeamPerformance';
import { useTeam } from '../hooks/useTeam';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { useServices } from '../../services/hooks/useServices';

type Tab = 'members' | 'performance';

export const TeamListPage: React.FC = () => {
  const [showArchived, setShowArchived] = useState(false);
  const { team, allStaff, isLoading, searchTerm, setSearchTerm } = useTeam(showArchived);
  const { allAppointments: appointments } = useAppointments();
  const { serviceCategories } = useServices();
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const navigate = useNavigate();

  return (
    <div className="w-full">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab('members')}
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
          onClick={() => setActiveTab('performance')}
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

      {activeTab === 'members' && isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
        </div>
      )}

      {activeTab === 'members' && !isLoading && (
        <TeamList
          team={team}
          appointments={appointments}
          serviceCategories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={() => navigate('/team/new')}
          onSelect={(id) => navigate(`/team/${id}`)}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
        />
      )}

      {activeTab === 'performance' && (
        <TeamPerformance staff={allStaff} />
      )}
    </div>
  );
};
