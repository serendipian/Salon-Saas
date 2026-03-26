
import { StaffMember, WorkSchedule } from '../../types';

const DEFAULT_SCHEDULE: WorkSchedule = {
  monday: { isOpen: true, start: '09:00', end: '19:00' },
  tuesday: { isOpen: true, start: '09:00', end: '19:00' },
  wednesday: { isOpen: true, start: '09:00', end: '19:00' },
  thursday: { isOpen: true, start: '09:00', end: '19:00' },
  friday: { isOpen: true, start: '09:00', end: '19:00' },
  saturday: { isOpen: true, start: '10:00', end: '18:00' },
  sunday: { isOpen: false, start: '09:00', end: '18:00' },
};

export const INITIAL_TEAM: StaffMember[] = [
  {
    id: 'st1',
    firstName: 'Marie',
    lastName: 'Dupont',
    role: 'Manager',
    email: 'marie@lumiere.com',
    phone: '06 11 22 33 44',
    color: 'bg-rose-100 text-rose-800',
    skills: ['cat1', 'cat2'],
    active: true,
    
    // HR
    startDate: '2020-01-15',
    contractType: 'CDI',
    weeklyHours: 39,
    baseSalary: 2500,
    commissionRate: 10,
    bonusTiers: [
      { target: 150, bonus: 15 },
      { target: 250, bonus: 30 }
    ],
    socialSecurityNumber: '2850192039102',
    emergencyContactName: 'Pierre Dupont',
    emergencyContactRelation: 'Époux',
    emergencyContactPhone: '06 00 00 00 00',
    
    bio: 'Expert coloriste avec 10 ans d\'expérience.',
    schedule: DEFAULT_SCHEDULE
  },
  {
    id: 'st2',
    firstName: 'Julie',
    lastName: 'Dubois',
    role: 'Stylist',
    email: 'julie@lumiere.com',
    phone: '06 99 88 77 66',
    color: 'bg-blue-100 text-blue-800',
    skills: ['cat1'],
    active: true,
    
    // HR
    startDate: '2021-06-01',
    contractType: 'CDI',
    weeklyHours: 35,
    baseSalary: 1800,
    commissionRate: 15,
    bonusTiers: [],
    
    bio: 'Spécialiste des coupes modernes et visagisme.',
    schedule: DEFAULT_SCHEDULE
  }
];
