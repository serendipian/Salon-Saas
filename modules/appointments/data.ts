import { Appointment, AppointmentStatus } from '../../types';

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt1',
    clientId: 'c1',
    clientName: 'Sophie Martin',
    serviceId: 'srv1',
    serviceName: 'Coupe Brushing - Cheveux Longs',
    date: '2023-11-15T14:00:00',
    durationMinutes: 45,
    staffId: 'st1',
    staffName: 'Marie Dupont',
    status: AppointmentStatus.COMPLETED,
    price: 65,
    notes: 'Cliente en avance.'
  },
  {
    id: 'apt2',
    clientId: 'c3',
    clientName: 'Claire Lefebvre',
    serviceId: 'srv2',
    serviceName: 'Soin Hydratant Intense',
    date: '2023-11-16T10:00:00',
    durationMinutes: 60,
    staffId: 'st2',
    staffName: 'Julie Dubois',
    status: AppointmentStatus.SCHEDULED,
    price: 90
  },
  {
    id: 'apt3',
    clientId: 'c2',
    clientName: 'Julie Dubois',
    serviceId: 'srv1',
    serviceName: 'Coupe Brushing - Court',
    date: '2023-11-10T16:30:00',
    durationMinutes: 30,
    staffId: 'st1',
    staffName: 'Marie Dupont',
    status: AppointmentStatus.CANCELLED,
    price: 45,
    notes: 'Annulé par téléphone.'
  }
];