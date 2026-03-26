
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { Appointment, AppointmentStatus } from '../../../types';

export const useAppointments = () => {
  const { appointments, addAppointment, updateAppointment } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const matchesSearch = a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            a.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, searchTerm, statusFilter]);

  return {
    appointments: filteredAppointments,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    addAppointment,
    updateAppointment
  };
};
