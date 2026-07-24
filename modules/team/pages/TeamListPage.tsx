import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateRangePicker } from '../../../components/DateRangePicker';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import type { ServiceCategory, StaffMember } from '../../../types';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import { useServices } from '../../services/hooks/useServices';
import { TeamList } from '../components/TeamList';
import { TeamPerformance } from '../components/TeamPerformance';
import { useTeam } from '../hooks/useTeam';
import { useTeamPerformance } from '../hooks/useTeamPerformance';

type Tab = 'members' | 'performance';

/**
 * Owns the performance query so it only runs while the Performance tab is open
 * (it decrypts PII), and feeds the tab's date picker into the shared title bar.
 */
const TeamPerformanceTab: React.FC<{
  allStaff: StaffMember[];
  serviceCategories: ServiceCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}> = ({ allStaff, ...listProps }) => {
  const { performances, dateRange, setDateRange, totalRevenue, isLoadingPii } =
    useTeamPerformance(allStaff);
  const { isMobile } = useMediaQuery();

  // The date picker is too wide to share the title bar with the page title on
  // phones (it squeezes "Équipe" to zero width and overlaps the header buttons),
  // so on mobile it moves out of the bar and sits above the content instead —
  // same trade-off as the dashboard and the finances pages.
  const dateRangePicker = <DateRangePicker dateRange={dateRange} onChange={setDateRange} />;

  return (
    <TeamList
      {...listProps}
      team={[]}
      appointments={[]}
      onSelect={() => {}}
      performanceActions={!isMobile && dateRangePicker}
      performanceContent={
        <>
          {isMobile && <div className="mb-4">{dateRangePicker}</div>}
          <TeamPerformance
            performances={performances}
            totalRevenue={totalRevenue}
            isLoadingPii={isLoadingPii}
          />
        </>
      }
    />
  );
};

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
        <TeamPerformanceTab
          allStaff={allStaff}
          serviceCategories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={() => navigate('/team/new')}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </div>
  );
};
