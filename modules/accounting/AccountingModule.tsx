
import React, { useState } from 'react';
import { PieChart, FileText, Receipt, Plus } from 'lucide-react';
import { useAccounting } from './hooks/useAccounting';
import { AccountingOverview } from './components/AccountingOverview';
import { AccountingLedger } from './components/AccountingLedger';
import { AccountingExpenses } from './components/AccountingExpenses';
import { ExpenseForm } from './components/ExpenseForm';
import { Expense } from '../../types';
import { DateRangePicker } from '../../components/DateRangePicker';

export const AccountingModule: React.FC = () => {
  const { 
    dateRange, 
    setDateRange, 
    filteredTransactions, 
    filteredExpenses, 
    financials, 
    ledgerData, 
    chartData,
    addExpense 
  } = useAccounting();

  const [view, setView] = useState<'LIST' | 'ADD'>('LIST');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER' | 'EXPENSES'>('OVERVIEW');

  const handleAddExpenseSubmit = (newExpense: Expense) => {
    addExpense(newExpense);
    setView('LIST');
  };

  // If adding expense, show full page form
  if (view === 'ADD') {
    return (
      <ExpenseForm 
        onSave={handleAddExpenseSubmit} 
        onCancel={() => setView('LIST')} 
      />
    );
  }

  return (
    <div className="w-full relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pt-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Comptabilité</h1>
          <p className="text-sm text-slate-500">Vue d'ensemble financière</p>
        </div>
        
        <div className="flex items-center gap-3">
           {/* New Shopify-style Date Picker */}
           <DateRangePicker 
             dateRange={dateRange}
             onChange={setDateRange}
           />

           <button 
              onClick={() => setView('ADD')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
            >
             <Plus size={16} />
             Nouvelle Dépense
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
         {[
            { id: 'OVERVIEW', label: "Vue d'ensemble", icon: PieChart },
            { id: 'LEDGER', label: "Grand Livre", icon: FileText },
            { id: 'EXPENSES', label: "Dépenses", icon: Receipt }
         ].map(tab => (
           <button 
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
           >
             <tab.icon size={16} />
             {tab.label}
           </button>
         ))}
      </div>

      {/* Content */}
      {activeTab === 'OVERVIEW' && (
        <AccountingOverview 
          financials={financials} 
          chartData={chartData} 
          filteredTransactions={filteredTransactions} 
          filteredExpenses={filteredExpenses} 
        />
      )}

      {activeTab === 'LEDGER' && <AccountingLedger data={ledgerData} />}

      {activeTab === 'EXPENSES' && <AccountingExpenses expenses={filteredExpenses} />}
    </div>
  );
};
