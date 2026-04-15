import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type React from 'react';
import { formatPrice } from '../../../lib/format';
import type { LedgerEntry } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';

export const AccountingLedger: React.FC<{ data: LedgerEntry[] }> = ({ data }) => {
  const { expenseCategories } = useSettings();

  const getCategoryName = (idOrName: string) => {
    const cat = expenseCategories.find((c) => c.id === idOrName);
    return cat ? cat.name : idOrName;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-bold text-slate-900 text-sm">Grand Livre Journalier</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Libellé</th>
              <th className="px-6 py-4">Catégorie</th>
              <th className="px-6 py-4 text-right">Débit (-)</th>
              <th className="px-6 py-4 text-right">Crédit (+)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((entry, idx) => (
              <tr
                key={`${entry.id}-${idx}`}
                className="hover:bg-slate-50/80 transition-colors text-sm"
              >
                <td className="px-6 py-4 text-slate-500">
                  {new Date(entry.date).toLocaleDateString()}
                  <span className="text-xs text-slate-400 ml-2">
                    {new Date(entry.date).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {entry.type === 'INCOME' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold">
                      <ArrowUpRight size={10} /> Recette
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 text-xs font-bold">
                      <ArrowDownRight size={10} /> Dépense
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">{entry.label}</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                    {getCategoryName(entry.category)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-600">
                  {entry.type === 'EXPENSE' ? formatPrice(entry.amount) : '-'}
                </td>
                <td className="px-6 py-4 text-right font-mono text-emerald-700 font-bold">
                  {entry.type === 'INCOME' ? formatPrice(entry.amount) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
