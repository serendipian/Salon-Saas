
import React from 'react';
import { Expense } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ExpenseTable } from './ExpenseTable';
import { ExpenseCard } from './ExpenseCard';

export const AccountingExpenses: React.FC<{ expenses: Expense[] }> = ({ expenses }) => {
  const { viewMode, setViewMode } = useViewMode('expenses');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-3 border-b border-slate-200 flex justify-end bg-white">
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
