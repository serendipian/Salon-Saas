
import React, { useState } from 'react';
import { Appointment, ViewState } from '../../types';
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
    isAddingGroup,
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

  const selectedAppt = appointments.find(a => a.id === selectedApptId);

  return (
    <div className="w-full">
      {view === 'LIST' && (
        <AppointmentList
          appointments={appointments}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAdd={handleAdd}
          onDetails={handleDetails}
        />
      )}

      {view === 'DETAILS' && selectedAppt && (
        <AppointmentDetails
          appointment={selectedAppt}
          allAppointments={allAppointments}
          onBack={() => setView('LIST')}
          onEdit={() => setView('EDIT')}
        />
      )}

      {(view === 'ADD' || view === 'EDIT') && (
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
                  last_name: payload.newClient.lastName,
                  phone: payload.newClient.phone,
                })
                .select('id')
                .single();

              if (clientError) {
                addToast({ type: 'error', message: 'Erreur lors de la création du client' });
                return;
              }
              payload.clientId = newClientRow.id;
            }
            try {
              await addAppointmentGroup(payload);
              setView('LIST');
            } catch {
              // Error toast handled by mutation's onError
            }
          }}
          onCancel={() => view === 'EDIT' ? setView('DETAILS') : setView('LIST')}
          isSaving={isAddingGroup}
        />
      )}
    </div>
  );
};
