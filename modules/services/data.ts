import { Service, ServiceCategory } from '../../types';

export const INITIAL_SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'cat1', name: 'Coiffure', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'cat2', name: 'Soins Visage', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'cat3', name: 'Manucure', color: 'bg-purple-100 text-purple-800 border-purple-200' },
];

export const INITIAL_SERVICES: Service[] = [
  {
    id: 'srv1',
    name: 'Coupe Brushing',
    categoryId: 'cat1',
    description: 'Une coupe rafraîchissante suivie d\'un brushing volumateur pour un style impeccable.',
    active: true,
    variants: [
      { id: 'v1', name: 'Cheveux Courts', durationMinutes: 30, price: 45, cost: 10 },
      { id: 'v2', name: 'Cheveux Longs', durationMinutes: 45, price: 65, cost: 15 },
    ]
  },
  {
    id: 'srv2',
    name: 'Soin Hydratant Intense',
    categoryId: 'cat2',
    description: 'Un soin profond pour redonner éclat et souplesse à votre peau.',
    active: true,
    variants: [
      { id: 'v3', name: 'Standard', durationMinutes: 60, price: 90, cost: 25 },
    ]
  }
];