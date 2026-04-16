import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { FinancesOutletContext } from '../FinancesLayout';
import { AccountingExpenses } from './AccountingExpenses';
import { DepensesRecurrentes } from './DepensesRecurrentes';
import { ExpenseForm } from './ExpenseForm';
import { MiniKpiRow } from './MiniKpiRow';

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
    expenseTab: activeTab,
    registerNewExpenseHandler,
  } = useOutletContext<FinancesOutletContext>();

  const [showForm, setShowForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const expenseCount = filteredExpenses.length;
  const expenseTotal = financials.opex;
  const avgExpense = expenseCount > 0 ? expenseTotal / expenseCount : 0;

  const openNewExpense = useCallback(() => {
    setEditingExpenseId(null);
    setShowForm(true);
  }, []);

  // Register the new-expense handler so the layout header can render its button
  useEffect(() => {
    registerNewExpenseHandler(openNewExpense);
    return () => registerNewExpenseHandler(null);
  }, [registerNewExpenseHandler, openNewExpense]);

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
      {activeTab === 'COURANTES' && (
        <>
          <MiniKpiRow
            items={[
              {
                title: 'Total Dépenses',
                value: expenseTotal,
                trend: financials.opexTrend,
                invertTrend: true,
              },
              { title: 'Nb Dépenses', value: expenseCount, format: 'number' },
              { title: 'Moyenne par Dépense', value: avgExpense },
            ]}
          />
          <AccountingExpenses expenses={filteredExpenses} onEdit={handleEdit} />
        </>
      )}

      {activeTab === 'RECURRENTES' && <DepensesRecurrentes onCreateExpense={addExpense} />}
    </div>
  );
};
