import { Client } from '../../types';

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    firstName: 'Sophie',
    lastName: 'Martin',
    email: 'sophie.martin@example.com',
    phone: '06 12 34 56 78',
    city: 'Casablanca',
    status: 'VIP',
    totalVisits: 12,
    totalSpent: 850,
    lastVisitDate: '2023-10-15',
    notes: 'Allergique au latex. Préfère le thé vert.',
    createdAt: '2023-01-10',
    permissions: { socialMedia: true, marketing: true, other: false }
  },
  {
    id: 'c2',
    firstName: 'Julie',
    lastName: 'Dubois',
    email: 'j.dubois@test.com',
    phone: '07 98 76 54 32',
    city: 'Rabat',
    status: 'ACTIF',
    totalVisits: 3,
    totalSpent: 120,
    lastVisitDate: '2023-11-02',
    createdAt: '2023-08-15',
    permissions: { socialMedia: false, marketing: true, other: false }
  },
  {
    id: 'c3',
    firstName: 'Claire',
    lastName: 'Lefebvre',
    email: 'claire.l@domain.com',
    phone: '06 55 44 33 22',
    city: 'Marrakech',
    status: 'ACTIF',
    totalVisits: 25,
    totalSpent: 2100,
    lastVisitDate: '2023-11-10',
    notes: 'Cliente VIP. Toujours proposer les nouveautés.',
    createdAt: '2022-05-20',
    permissions: { socialMedia: true, marketing: false, other: false }
  }
];