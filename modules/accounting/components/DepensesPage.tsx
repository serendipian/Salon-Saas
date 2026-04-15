import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { MiniKpiRow } from './MiniKpiRow';
import { AccountingExpenses } from './AccountingExpenses';
import { ExpenseForm } from './ExpenseForm';
import { DepensesRecurrentes } from './DepensesRecurrentes';
import type { FinancesOutletContext } from '../FinancesLayout';

type Tab = 'COURANTES' | 'RECURRENTES';

export const DepensesPage: React.FC = () => {
  const {
    filteredExpenses,
    addExpense,
    isAddingExpense,
    updateExpense,
    isUpdatingExpense,
    deleteExpense,
    isDeletingExpense,
    financials,
  } = useOutletContext<FinancesOutletContext>();

  const [activeTab, setActiveTab] = useState<Tab>('COURANTES');
  const [showForm, setShowForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const expenseCount = filteredExpenses.length;
  const expenseTotal = financials.opex;
  const avgExpense = expenseCount > 0 ? expenseTotal / expenseCount : 0;

  const handleAddExpense = (expense: Parameters<typeof addExpense>[0]) => {
    addExpense(expense);
    setShowForm(false);
  };

  const handleEdit = (id: string) => {
    setEditingExpenseId(id);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingExpenseId(null);
  };

  const editingExpense = editingExpenseId
    ? filteredExpenses.find((e) => e.id === editingExpenseId)
    : undefined;

  if (showForm) {
    return (
      <ExpenseForm
        existingExpense={editingExpense}
        allExpenses={filteredExpenses}
        onSave={handleAddExpense}
        onUpdate={(expense) => {
          updateExpense(expense);
          handleClose();
        }}
        onDelete={(id) => {
          deleteExpense(id);
          handleClose();
        }}
        onCancel={handleClose}
        isPending={isAddingExpense || isUpdatingExpense || isDeletingExpense}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-slate-200">
          {[
            { id: 'COURANTES' as Tab, label: 'Courantes' },
            { id: 'RECURRENTES' as Tab, label: 'R\u00e9currentes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'COURANTES' && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} /> Nouvelle D{'\u00e9'}pense
          </button>
        )}
      </div>

      {activeTab === 'COURANTES' && (
        <>
          <MiniKpiRow
            items={[
              {
                title: 'Total D\u00e9penses',
                value: expenseTotal,
                trend: financials.opexTrend,
                invertTrend: true,
              },
              { title: 'Nb D\u00e9penses', value: expenseCount, format: 'number' },
              { title: 'Moyenne par D\u00e9pense', value: avgExpense },
            ]}
          />
          <AccountingExpenses expenses={filteredExpenses} onEdit={handleEdit} />
        </>
      )}

      {activeTab === 'RECURRENTES' && <DepensesRecurrentes onCreateExpense={addExpense} />}
    </div>
  );
};
