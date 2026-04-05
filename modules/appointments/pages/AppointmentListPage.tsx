
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { AppointmentList } from '../components/AppointmentList';

export const AppointmentListPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    appointments,
    allAppointments,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    deleteAppointment,
  } = useAppointments();
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
      allAppointments={allAppointments}
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
    />
  );
};
