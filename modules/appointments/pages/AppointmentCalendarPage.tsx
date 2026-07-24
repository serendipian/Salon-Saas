import { Plus } from 'lucide-react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { FreshnessIndicator } from '../../../components/FreshnessIndicator';
import { PageHeader } from '../../../components/PageHeader';
import { useAuth } from '../../../context/AuthContext';
import { useFreshness } from '../../../hooks/useFreshness';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { CalendarView } from '../components/CalendarView';
import { useAppointments } from '../hooks/useAppointments';

export const AppointmentCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const { lastUpdated } = useFreshness({
    queryKeyRoots: ['appointments', 'clients', 'services'],
    salonId,
  });
  const { allAppointments, updateAppointment } = useAppointments();
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  return (
    <div className="animate-in fade-in">
      <PageHeader
        title="Agenda"
        meta={
          lastUpdated !== undefined && (
            <div className="hidden sm:block">
              <FreshnessIndicator updatedAt={lastUpdated} />
            </div>
          )
        }
        actions={
          <button
            onClick={() => navigate('/calendar/new')}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white h-10 px-3.5 sm:px-4 rounded-lg font-medium text-sm shadow-sm transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus:outline-none"
          >
            <Plus size={16} />
            <span>Nouveau RDV</span>
          </button>
        }
      />

      <CalendarView
        allAppointments={allAppointments}
        serviceCategories={serviceCategories}
        services={services}
        allStaff={team}
        onViewDetails={(id) => navigate(`/calendar/${id}`)}
        onEdit={(id) => navigate(`/calendar/${id}/edit`)}
        onUpdateAppointment={updateAppointment}
      />
    </div>
  );
};
