
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      {activeTab === 'members' && isLoading && (
        <TeamList
          team={[]}
          appointments={[]}
          serviceCategories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={() => navigate('/team/new')}
          onSelect={() => {}}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isLoading
        />
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
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}

      {activeTab === 'performance' && (
        <TeamList
          team={[]}
          appointments={[]}
          serviceCategories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={() => navigate('/team/new')}
          onSelect={() => {}}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          performanceContent={<TeamPerformance staff={allStaff} />}
        />
      )}
    </div>
  );
};
