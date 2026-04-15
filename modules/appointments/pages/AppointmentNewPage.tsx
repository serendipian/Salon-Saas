import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { usePacks } from '../../services/hooks/usePacks';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { supabase } from '../../../lib/supabase';
import AppointmentBuilder from '../components/AppointmentBuilder';
import AppointmentBuilderMobile from '../components/AppointmentBuilderMobile';

export const AppointmentNewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const { isMobile } = useMediaQuery();
  const { allAppointments, addAppointmentGroup } = useAppointments();
  const { allClients: clients } = useClients();
  const { allServices: services, serviceCategories, favorites } = useServices();
  const { allStaff: team } = useTeam();
  const { validPacks } = usePacks();

  const handleSave = async (
    payload: Parameters<typeof addAppointmentGroup>[0] & {
      newClient: { firstName: string; lastName: string; phone: string } | null;
    },
  ) => {
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
  };

  const preselectedClientId = searchParams.get('clientId');

  const sharedProps = {
    services,
    categories: serviceCategories,
    favorites,
    packs: validPacks,
    team,
    clients,
    appointments: allAppointments,
    onSave: handleSave,
    onCancel: () => navigate('/calendar'),
    ...(preselectedClientId ? { initialData: { clientId: preselectedClientId } } : {}),
  };

  if (isMobile) {
    return <AppointmentBuilderMobile {...sharedProps} />;
  }
  return <AppointmentBuilder {...sharedProps} />;
};
