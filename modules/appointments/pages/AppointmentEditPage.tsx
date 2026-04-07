
import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { useClients } from '../../clients/hooks/useClients';
import { useServices } from '../../services/hooks/useServices';
import { useTeam } from '../../team/hooks/useTeam';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import { ServiceBlockState } from '../../../types';
import AppointmentBuilder from '../components/AppointmentBuilder';

export const AppointmentEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const { allAppointments, editAppointmentGroup, deleteAppointment } = useAppointments();
  const { allClients: clients } = useClients();
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  const selectedAppt = allAppointments.find(a => a.id === id);

  // IDs of appointments in this group — exclude from availability check
  const excludeAppointmentIds = useMemo(() => {
    if (!selectedAppt) return [];
    if (selectedAppt.groupId) {
      return allAppointments.filter(a => a.groupId === selectedAppt.groupId).map(a => a.id);
    }
    return [selectedAppt.id];
  }, [selectedAppt, allAppointments]);

  const editInitialData = useMemo(() => {
    if (!selectedAppt) return undefined;

    const groupAppts = selectedAppt.groupId
      ? allAppointments.filter(a => a.groupId === selectedAppt.groupId)
      : [selectedAppt];

    const serviceBlocks: ServiceBlockState[] = groupAppts.map(appt => {
      const dateObj = new Date(appt.date);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      const svc = services.find(s => s.id === appt.serviceId);
      const variant = svc?.variants.find(v => v.price === appt.price && v.durationMinutes === appt.durationMinutes);

      return {
        id: crypto.randomUUID(),
        categoryId: svc?.categoryId ?? null,
        serviceId: appt.serviceId || null,
        variantId: variant?.id ?? null,
        staffId: appt.staffId || null,
        date: dateStr,
        hour: dateObj.getHours(),
        minute: dateObj.getMinutes(),
      };
    });

    return {
      clientId: selectedAppt.clientId,
      status: selectedAppt.status,
      notes: selectedAppt.notes ?? '',
      reminderMinutes: null as number | null,
      serviceBlocks,
    };
  }, [selectedAppt, allAppointments, services]);

  if (!selectedAppt) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Rendez-vous introuvable
      </div>
    );
  }

  return (
    <AppointmentBuilder
      services={services}
      categories={serviceCategories}
      team={team}
      clients={clients}
      appointments={allAppointments}
      excludeAppointmentIds={excludeAppointmentIds}
      initialData={editInitialData}
      onSave={async (payload) => {
        if (payload.newClient && activeSalon) {
          const { data: newClientRow, error: clientError } = await supabase
            .from('clients')
            .insert({
              salon_id: activeSalon.id,
              first_name: payload.newClient.firstName,
              last_name: payload.newClient.lastName || null,
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
        await editAppointmentGroup({
          oldAppointmentId: id!,
          ...payload,
        });
        navigate('/calendar');
      }}
      onCancel={() => navigate(`/calendar/${id}`)}
      onDelete={async () => {
        try {
          await deleteAppointment(id!);
          navigate('/calendar');
        } catch {
          // Error toast handled by mutation's onError
        }
      }}
    />
  );
};
