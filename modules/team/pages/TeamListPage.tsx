
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BarChart2 } from 'lucide-react';
import { TeamList } from '../components/TeamList';
import { TeamPerformance } from '../components/TeamPerformance';
import { useTeam } from '../hooks/useTeam';
import { useAppointments } from '../../appointments/hooks/useAppointments';

type Tab = 'members' | 'performance';

export const TeamListPage: React.FC = () => {
  const { team, allStaff, searchTerm, setSearchTerm } = useTeam();
  const { allAppointments: appointments } = useAppointments();
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

      {activeTab === 'members' && (
        <TeamList
          team={team}
          appointments={appointments}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={() => navigate('/team/new')}
          onSelect={(id) => navigate(`/team/${id}`)}
        />
      )}

      {activeTab === 'performance' && (
        <TeamPerformance staff={allStaff} />
      )}
    </div>
  );
};
