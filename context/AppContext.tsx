
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Client,
  Appointment,
  Transaction,
  Expense,
  StaffMember,
  RecurringExpense,
  ExpenseCategorySetting,
  SalonSettings
} from '../types';

// Modular Data Imports
import { MOCK_CLIENTS } from '../modules/clients/data';
import { MOCK_APPOINTMENTS } from '../modules/appointments/data';
import { INITIAL_TEAM } from '../modules/team/data';

// --- Mock Generators (Internal to Context now) ---
const generateMockTransactions = (clients: Client[]): Transaction[] => {
  const transactions: Transaction[] = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (date.getDay() === 0 && Math.random() > 0.2) continue;
    const dailyCount = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < dailyCount; j++) {
      const amount = Math.floor(Math.random() * 150) + 40;
      const finalAmount = Math.random() > 0.95 ? amount * 5 : amount; 
      const cost = finalAmount * (Math.random() * 0.15 + 0.1);
      transactions.push({
        id: `trx-${i}-${j}`,
        date: date.toISOString(),
        total: finalAmount,
        clientName: clients[j % clients.length]?.lastName || 'Client Passage',
        clientId: clients[j % clients.length]?.id,
        items: [
          { 
            id: 'item1', 
            referenceId: 'ref1', 
            type: 'SERVICE', 
            name: Math.random() > 0.5 ? 'Coupe Brushing' : 'Coloration', 
            price: finalAmount, 
            quantity: 1,
            cost: cost
          }
        ],
        payments: [{ id: 'p1', method: 'Carte Bancaire', amount: finalAmount }]
      });
    }
  }
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const generateMockExpenses = (): Expense[] => {
  const expenses: Expense[] = [];
  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 5);
    // Using IDs '1', '2', '3' to match default categories
    expenses.push({ id: `rent-${i}`, date: d.toISOString(), description: 'Loyer Commercial', category: '1', amount: 1200, supplier: 'Agence Immo' });
    expenses.push({ id: `sal-${i}`, date: d.toISOString(), description: 'Salaires Équipe', category: '2', amount: 2500, supplier: 'Staff' });
    expenses.push({ id: `stock-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 12).toISOString(), description: 'Réassort Produits', category: '3', amount: Math.random() * 500 + 200, supplier: 'L\'Oréal' });
    expenses.push({ id: `rand-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 18).toISOString(), description: 'Maintenance', category: '5', amount: Math.random() * 150, supplier: 'ReparTout' });
  }
  return expenses;
};

interface AppContextType {
  // Clients
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;

  // Appointments
  appointments: Appointment[];
  addAppointment: (appt: Appointment) => void;
  updateAppointment: (appt: Appointment) => void;

  // Team
  team: StaffMember[];
  addStaffMember: (staff: StaffMember) => void;
  updateStaffMember: (staff: StaffMember) => void;

  // POS & Accounting
  transactions: Transaction[];
  expenses: Expense[];
  addTransaction: (transaction: Transaction) => void;
  addExpense: (expense: Expense) => void;

  // Settings & Helpers
  salonSettings: SalonSettings;
  updateSalonSettings: (settings: SalonSettings) => void;
  expenseCategories: ExpenseCategorySetting[];
  recurringExpenses: RecurringExpense[];
  updateExpenseCategories: (cats: ExpenseCategorySetting[]) => void;
  updateRecurringExpenses: (exps: RecurringExpense[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- State Initialization ---
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [team, setTeam] = useState<StaffMember[]>(INITIAL_TEAM);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Settings State
  const [salonSettings, setSalonSettings] = useState<SalonSettings>({
    name: 'Lumière Beauty',
    address: '12 Avenue des Champs-Élysées, 75008 Paris',
    phone: '01 23 45 67 89',
    email: 'contact@lumiere-beauty.com',
    website: 'www.lumiere-beauty.com',
    currency: 'EUR',
    vatRate: 20,
    schedule: {
      monday: { isOpen: true, start: '09:00', end: '19:00' },
      tuesday: { isOpen: true, start: '09:00', end: '19:00' },
      wednesday: { isOpen: true, start: '09:00', end: '19:00' },
      thursday: { isOpen: true, start: '09:00', end: '19:00' },
      friday: { isOpen: true, start: '09:00', end: '19:00' },
      saturday: { isOpen: true, start: '10:00', end: '18:00' },
      sunday: { isOpen: false, start: '09:00', end: '18:00' },
    }
  });

  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategorySetting[]>([
    { id: '1', name: 'Loyer', color: 'bg-purple-100 text-purple-700' },
    { id: '2', name: 'Salaires', color: 'bg-blue-100 text-blue-700' },
    { id: '3', name: 'Stock', color: 'bg-amber-100 text-amber-700' },
    { id: '4', name: 'Marketing', color: 'bg-pink-100 text-pink-700' },
    { id: '5', name: 'Divers', color: 'bg-slate-100 text-slate-700' },
  ]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([
    { id: 'rec1', name: 'Loyer Commercial', amount: 1200, frequency: 'Mensuel', nextDate: '2023-12-01' },
    { id: 'rec2', name: 'Abonnement Internet', amount: 45.90, frequency: 'Mensuel', nextDate: '2023-12-05' },
  ]);

  // Initialize History
  useEffect(() => {
    setTransactions(generateMockTransactions(clients));
    setExpenses(generateMockExpenses());
  }, []);

  // --- Actions ---

  // Clients
  const addClient = (c: Client) => setClients(prev => [...prev, { ...c, id: c.id || `c${Date.now()}` }]);
  const updateClient = (c: Client) => setClients(prev => prev.map(item => item.id === c.id ? c : item));
  const deleteClient = (id: string) => setClients(prev => prev.filter(item => item.id !== id));

  // Appointments
  const addAppointment = (a: Appointment) => setAppointments(prev => [...prev, { ...a, id: a.id || `apt${Date.now()}` }]);
  const updateAppointment = (a: Appointment) => setAppointments(prev => prev.map(item => item.id === a.id ? a : item));

  // Team
  const addStaffMember = (s: StaffMember) => setTeam(prev => [...prev, { ...s, id: s.id || `st${Date.now()}` }]);
  const updateStaffMember = (s: StaffMember) => setTeam(prev => prev.map(item => item.id === s.id ? s : item));

  // Financials
  const addTransaction = (t: Transaction) => {
    setTransactions(prev => [t, ...prev]);
    
    // Note: Product stock updates moved to Supabase in Plan 2C (transaction migration)

    // Logic: Update Client Spending
    if (t.clientId) {
       setClients(currentClients => 
         currentClients.map(c => {
           if (c.id === t.clientId) {
             return { 
               ...c, 
               totalSpent: c.totalSpent + t.total,
               totalVisits: c.totalVisits + 1,
               lastVisitDate: t.date.split('T')[0]
             };
           }
           return c;
         })
       );
    }
  };

  const addExpense = (e: Expense) => setExpenses(prev => [...prev, e]);

  // Settings
  const updateSalonSettings = (s: SalonSettings) => setSalonSettings(s);
  const updateExpenseCategories = (cats: ExpenseCategorySetting[]) => setExpenseCategories(cats);
  const updateRecurringExpenses = (exps: RecurringExpense[]) => setRecurringExpenses(exps);

  const value = {
    clients, addClient, updateClient, deleteClient,
    appointments, addAppointment, updateAppointment,
    team, addStaffMember, updateStaffMember,
    transactions, expenses, addTransaction, addExpense,
    salonSettings, updateSalonSettings,
    expenseCategories, recurringExpenses, updateExpenseCategories, updateRecurringExpenses
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
