
import React, { useState } from 'react';
import { Appointment, ViewState } from '../../types';
import { useAppointments } from './hooks/useAppointments';
import { AppointmentList } from './components/AppointmentList';
import { AppointmentForm } from './components/AppointmentForm';
import { AppointmentDetails } from './components/AppointmentDetails';

export const AppointmentsModule: React.FC = () => {
  const { 
    appointments, 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter, 
    addAppointment, 
    updateAppointment 
  } = useAppointments();

  const [view, setView] = useState<ViewState>('LIST');
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedApptId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedApptId(id);
    setView('EDIT');
  };

  const handleDetails = (id: string) => {
    setSelectedApptId(id);
    setView('DETAILS');
  };

  const handleSave = (appt: Appointment) => {
    if (selectedApptId && view === 'EDIT') {
      updateAppointment(appt);
      setView('DETAILS');
    } else {
      addAppointment(appt);
      setView('LIST');
    }
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
          onBack={() => setView('LIST')}
          onEdit={() => setView('EDIT')}
        />
      )}

      {(view === 'ADD' || view === 'EDIT') && (
        <AppointmentForm 
          existingAppointment={view === 'EDIT' ? selectedAppt : undefined}
          onSave={handleSave}
          onCancel={() => view === 'EDIT' ? setView('DETAILS') : setView('LIST')}
        />
      )}
    </div>
  );
};
