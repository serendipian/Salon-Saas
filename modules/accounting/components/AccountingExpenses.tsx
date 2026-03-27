
import React from 'react';
import { Expense } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ExpenseTable } from './ExpenseTable';
import { ExpenseCard } from './ExpenseCard';

export const AccountingExpenses: React.FC<{ expenses: Expense[] }> = ({ expenses }) => {
  const { viewMode, setViewMode } = useViewMode('expenses');

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === 'table' ? (
        <ExpenseTable expenses={expenses} />
      ) : (
        <ExpenseCard expenses={expenses} />
      )}
    </div>
  );
};
