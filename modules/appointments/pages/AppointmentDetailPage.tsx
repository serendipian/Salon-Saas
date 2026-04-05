
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { AppointmentDetails } from '../components/AppointmentDetails';

export const AppointmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allAppointments, deleteAppointment } = useAppointments();

  const appointment = allAppointments.find(a => a.id === id);

  if (!appointment) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Rendez-vous introuvable
      </div>
    );
  }

  const handleDelete = async (apptId: string) => {
    try {
      await deleteAppointment(apptId);
      navigate('/calendar');
    } catch {
      // Error toast handled by mutation's onError
    }
  };

  return (
    <AppointmentDetails
      appointment={appointment}
      allAppointments={allAppointments}
      onBack={() => navigate('/calendar')}
      onEdit={() => navigate(`/calendar/${id}/edit`)}
      onDelete={handleDelete}
    />
  );
};
