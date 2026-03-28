
import React, { useState } from 'react';
import { Appointment, ServiceBlockState, ViewState } from '../../types';
import { useAppointments } from './hooks/useAppointments';
import { useClients } from '../clients/hooks/useClients';
import { useServices } from '../services/hooks/useServices';
import { useTeam } from '../team/hooks/useTeam';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { AppointmentList } from './components/AppointmentList';
import AppointmentBuilder from './components/AppointmentBuilder';
import { AppointmentDetails } from './components/AppointmentDetails';

export const AppointmentsModule: React.FC = () => {
  const { activeSalon } = useAuth();
  const { addToast } = useToast();
  const {
    appointments,
    allAppointments,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    addAppointmentGroup,
    deleteAppointment,
  } = useAppointments();

  const { allClients: clients } = useClients();
  const { allServices: services, serviceCategories } = useServices();
  const { allStaff: team } = useTeam();

  const [view, setView] = useState<ViewState>('LIST');
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedApptId(null);
    setView('ADD');
  };

  const handleDetails = (id: string) => {
    setSelectedApptId(id);
    setView('DETAILS');
  };

  const handleEdit = (id: string) => {
    setSelectedApptId(id);
    setView('EDIT');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAppointment(id);
      if (view !== 'LIST') setView('LIST');
    } catch {
      // Error toast handled by mutation's onError
    }
  };

  const selectedAppt = allAppointments.find(a => a.id === selectedApptId) ?? appointments.find(a => a.id === selectedApptId);

  // Build initialData for edit mode
  const editInitialData = React.useMemo(() => {
    if (view !== 'EDIT' || !selectedAppt) return undefined;

    // Find all appointments in the same group (or just the single appointment)
    const groupAppts = selectedAppt.groupId
      ? allAppointments.filter(a => a.groupId === selectedAppt.groupId)
      : [selectedAppt];

    // Convert each appointment to a ServiceBlockState
    const serviceBlocks: ServiceBlockState[] = groupAppts.map(appt => {
      const dateObj = new Date(appt.date);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      // Find the service to get categoryId
      const svc = services.find(s => s.id === appt.serviceId);
      // Find the variant by matching price+duration (best effort)
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
  }, [view, selectedAppt, allAppointments, services]);

  return (
    <div className="w-full">
      {view === 'LIST' && (
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
          onAdd={handleAdd}
          onDetails={handleDetails}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {view === 'DETAILS' && selectedAppt && (
        <AppointmentDetails
          appointment={selectedAppt}
          allAppointments={allAppointments}
          onBack={() => setView('LIST')}
          onEdit={() => setView('EDIT')}
          onDelete={handleDelete}
        />
      )}

      {(view === 'ADD' || view === 'EDIT') && (
        <AppointmentBuilder
          services={services}
          categories={serviceCategories}
          team={team}
          clients={clients}
          appointments={allAppointments}
          initialData={editInitialData}
          onSave={async (payload) => {
            if (payload.newClient && activeSalon) {
              const { data: newClientRow, error: clientError } = await supabase
                .from('clients')
                .insert({
                  salon_id: activeSalon.id,
                  first_name: payload.newClient.firstName,
                  last_name: payload.newClient.lastName,
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
            // In edit mode, delete old appointment(s) first then recreate
            if (view === 'EDIT' && selectedApptId) {
              await deleteAppointment(selectedApptId);
            }
            await addAppointmentGroup(payload);
            setView('LIST');
          }}
          onCancel={() => view === 'EDIT' ? setView('DETAILS') : setView('LIST')}
          onDelete={view === 'EDIT' && selectedApptId ? () => handleDelete(selectedApptId) : undefined}
        />
      )}
    </div>
  );
};
