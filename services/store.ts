import { Transaction, Expense, ExpenseCategory } from '../types';
import { MOCK_CLIENTS } from '../components/ClientsModule';

// --- Mock Data Generators ---

const generateMockTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const today = new Date();
  
  // Generate 90 days of history
  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    // Skip some Sundays
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
        clientName: MOCK_CLIENTS[j % MOCK_CLIENTS.length]?.lastName || 'Client Passage',
        clientId: MOCK_CLIENTS[j % MOCK_CLIENTS.length]?.id,
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
    expenses.push({ id: `rent-${i}`, date: d.toISOString(), description: 'Loyer Commercial', category: 'LOYER', amount: 1200, supplier: 'Agence Immo' });
    expenses.push({ id: `sal-${i}`, date: d.toISOString(), description: 'Salaires Équipe', category: 'SALAIRE', amount: 2500, supplier: 'Staff' });
    expenses.push({ id: `stock-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 12).toISOString(), description: 'Réassort Produits', category: 'STOCK', amount: Math.random() * 500 + 200, supplier: 'L\'Oréal' });
    expenses.push({ id: `rand-${i}`, date: new Date(today.getFullYear(), today.getMonth() - i, 18).toISOString(), description: 'Maintenance', category: 'AUTRE', amount: Math.random() * 150, supplier: 'ReparTout' });
  }
  return expenses;
};

// --- Singleton Store ---

class Store {
  private transactions: Transaction[] = [];
  private expenses: Expense[] = [];

  constructor() {
    // Initialize with mock data
    this.transactions = generateMockTransactions();
    this.expenses = generateMockExpenses();
  }

  // Transactions (POS -> Accounting)
  getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  addTransaction(transaction: Transaction) {
    this.transactions = [transaction, ...this.transactions];
  }

  // Expenses (Accounting)
  getExpenses(): Expense[] {
    return [...this.expenses];
  }

  addExpense(expense: Expense) {
    this.expenses = [...this.expenses, expense];
  }
}

export const dataStore = new Store();