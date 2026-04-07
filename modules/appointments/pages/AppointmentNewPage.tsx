
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import AppointmentBuilder from '../components/AppointmentBuilder';

export const AppointmentNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const { allAppointments, addAppointmentGroup } = useAppointments();
  const { allClients: clients } = useClients();
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  return (
    <AppointmentBuilder
      services={services}
      categories={serviceCategories}
      team={team}
      clients={clients}
      appointments={allAppointments}
      onSave={async (payload) => {
        if (payload.newClient && activeSalon) {
          const { data: newClientRow, error: clientError } = await supabase
            .from('clients')
            .insert({
              salon_id: activeSalon.id,
              first_name: payload.newClient.firstName,
              last_name: payload.newClient.lastName || '',
              phone: payload.newClient.phone,
            })
            .select('id')
            .single();

          if (clientError) {
            addToast({ type: 'error', message: 'Erreur lors de la création du client' });
            throw clientError;
          }
          payload.clientId = newClientRow.id;
        }
        await addAppointmentGroup(payload);
        navigate('/calendar');
      }}
      onCancel={() => navigate('/calendar')}
    />
  );
};
