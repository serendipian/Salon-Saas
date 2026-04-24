import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useFreshness } from '../../../hooks/useFreshness';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { AppointmentList } from '../components/AppointmentList';
import { useAppointments } from '../hooks/useAppointments';

export const AppointmentListPage: React.FC = () => {
  const navigate = useNavigate();
  const { role, activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const [showDeleted, setShowDeleted] = useState(false);
  const { lastUpdated } = useFreshness({
    queryKeyRoots: ['appointments', 'clients', 'services'],
    salonId,
  });
  const {
    appointments,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    deleteAppointment,
    updateStatus,
  } = useAppointments(showDeleted);
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  const handleDelete = async (id: string) => {
    try {
      await deleteAppointment(id);
    } catch {
      // Error toast handled by mutation's onError
    }
  };

  return (
    <AppointmentList
      appointments={appointments}
      serviceCategories={serviceCategories}
      services={services}
      allStaff={team}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      onAdd={() => navigate('/calendar/new')}
      onDetails={(id) => navigate(`/calendar/${id}`)}
      onEdit={(id) => navigate(`/calendar/${id}/edit`)}
      onDelete={handleDelete}
      onStatusChange={(id, status) => updateStatus(id, status)}
      showDeleted={showDeleted}
      onToggleDeleted={role === 'owner' ? () => setShowDeleted(!showDeleted) : undefined}
      freshnessUpdatedAt={lastUpdated}
    />
  );
};
