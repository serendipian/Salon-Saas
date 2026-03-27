
import React from 'react';
import { Trash2, Tag } from 'lucide-react';
import { Expense } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

export const ExpenseTable: React.FC<{ expenses: Expense[] }> = ({ expenses }) => {
  const { expenseCategories } = useSettings();

  // Helper to get category details (Label + Color) from ID
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      <div className="overflow-x-auto">
         <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
               <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 hidden md:table-cell">Fournisseur</th>
                  <th className="px-6 py-4 hidden lg:table-cell">Catégorie</th>
                  <th className="px-6 py-4 text-right">Montant</th>
                  <th className="px-6 py-4 text-right"></th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {expenses.map((exp) => {
                  const { label, color } = getCategoryDetails(exp.category);

                  return (
                     <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors text-sm group">
                        <td className="px-6 py-4 text-slate-500 font-medium">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{exp.description}</td>
                        <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{exp.supplier || '-'}</td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-white/20 shadow-sm ${color}`}>
                              <Tag size={12} /> {label}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                           {formatPrice(exp.amount)}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <button className="p-2 text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={16} />
                           </button>
                        </td>
                     </tr>
                  );
               })}
            </tbody>
         </table>
      </div>
    </div>
  );
};
