import { Download, Filter, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ViewToggle } from '../../../components/ViewToggle';
import { useViewMode } from '../../../hooks/useViewMode';
import type { Expense, PaymentMethod } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { ExpenseCard } from './ExpenseCard';
import { ExpenseTable } from './ExpenseTable';

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'especes', label: 'Espèces' },
  { value: 'carte', label: 'Carte' },
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'prelevement', label: 'Prélèvement' },
];

const PAYMENT_LABELS: Record<string, string> = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  virement: 'Virement',
  cheque: 'Chèque',
  prelevement: 'Prélèvement',
};

export const AccountingExpenses: React.FC<{
  expenses: Expense[];
  onEdit?: (id: string) => void;
}> = ({ expenses, onEdit }) => {
  const { viewMode, setViewMode } = useViewMode('expenses');
  const { expenseCategories } = useSettings();
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');

  const filtered = useMemo(() => {
    let result = expenses;
    if (categoryFilter) result = result.filter((e) => e.category === categoryFilter);
    if (paymentFilter) result = result.filter((e) => e.paymentMethod === paymentFilter);
    return result;
  }, [expenses, categoryFilter, paymentFilter]);

  const hasFilters = categoryFilter || paymentFilter;

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) return;
    const catMap = new Map(expenseCategories.map((c) => [c.id, c.name]));
    const header = 'Date,Description,Catégorie,Fournisseur,Mode de paiement,Montant';
    const rows = filtered.map((e) => {
      const escape = (s?: string) => `"${(s || '').replace(/"/g, '""')}"`;
      return [
        e.date,
        escape(e.description),
        escape(catMap.get(e.category) || ''),
        escape(e.supplier),
        escape(e.paymentMethod ? PAYMENT_LABELS[e.paymentMethod] : ''),
        e.amount.toFixed(2),
      ].join(',');
    });
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, expenseCategories]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-3 border-b border-slate-200 flex items-center gap-2 flex-wrap bg-white">
        <Filter size={14} className="text-slate-400" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="">Toutes catégories</option>
          {expenseCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="">Tous paiements</option>
          {PAYMENT_METHOD_OPTIONS.map((pm) => (
            <option key={pm.value} value={pm.value}>
              {pm.label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setCategoryFilter('');
              setPaymentFilter('');
            }}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 ml-1"
          >
            <X size={12} /> Réinitialiser
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exporter en CSV"
          >
            <Download size={12} /> CSV
          </button>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>
      {viewMode === 'table' ? (
        <ExpenseTable expenses={filtered} onEdit={onEdit} />
      ) : (
        <ExpenseCard expenses={filtered} onEdit={onEdit} />
      )}
    </div>
  );
};
