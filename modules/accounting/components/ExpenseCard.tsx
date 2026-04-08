
import React from 'react';
import { Tag } from 'lucide-react';
import { Expense } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

export const ExpenseCard: React.FC<{ expenses: Expense[] }> = ({ expenses }) => {
  const { expenseCategories } = useSettings();

  const getCategoryDetails = (id: string) => {
    const category = expenseCategories.find(c => c.id === id);
    if (category) {
      return { label: category.name, color: category.color };
    }
    return { label: 'Autre', color: 'bg-slate-100 text-slate-700' };
  };

  if (expenses.length === 0) {
    return <EmptyState title="Aucune dépense trouvée" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {expenses.map((exp) => {
        const { label, color } = getCategoryDetails(exp.category);

        return (
          <div
            key={exp.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 group animate-in fade-in"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{exp.description}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(exp.date).toLocaleDateString()}</p>
              </div>
            </div>

            {exp.supplier && (
              <p className="text-xs text-slate-600 mb-2">{exp.supplier}</p>
            )}

            <div className="flex items-center justify-between gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-white/20 shadow-sm ${color}`}>
                <Tag size={12} /> {label}
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {formatPrice(exp.amount)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
