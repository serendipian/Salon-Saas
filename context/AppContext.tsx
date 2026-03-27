import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Transaction,
  Expense,
} from '../types';

// --- Mock Generators (Plan 2C will migrate these to Supabase) ---
const generateMockTransactions = (): Transaction[] => {
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
        clientName: 'Client Passage',
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
    expenses.push({ id: `rent-${i}`, date: d.toISOString(), description: 'Loyer Commercial', category: '1', amount: 1200, supplier: 'Agence Immo' });
    expenses.push({ id: `sal-${i}`, date: d.toISOString(), description: 'Salaires Équipe', category: '2', amount: 2500, supplier: 'Staff' });
    expenses.push({ id: `stock-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 12).toISOString(), description: 'Réassort Produits', category: '3', amount: Math.random() * 500 + 200, supplier: 'L\'Oréal' });
    expenses.push({ id: `rand-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 18).toISOString(), description: 'Maintenance', category: '5', amount: Math.random() * 150, supplier: 'ReparTout' });
  }
  return expenses;
};

interface AppContextType {
  // POS & Accounting (Plan 2C targets)
  transactions: Transaction[];
  expenses: Expense[];
  addTransaction: (transaction: Transaction) => void;
  addExpense: (expense: Expense) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Initialize mock history
  useEffect(() => {
    setTransactions(generateMockTransactions());
    setExpenses(generateMockExpenses());
  }, []);

  // --- Actions ---
  const addTransaction = (t: Transaction) => {
    setTransactions(prev => [t, ...prev]);
    // Note: Product stock updates moved to Supabase in Plan 2C (transaction migration)
    // Note: Client stats now computed by client_stats DB view, auto-updated on query refetch
  };

  const addExpense = (e: Expense) => setExpenses(prev => [...prev, e]);

  const value = {
    transactions, expenses, addTransaction, addExpense,
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
