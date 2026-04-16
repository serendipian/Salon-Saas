import { CheckCircle, Plus, RefreshCw, Trash2, Zap } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Input, Select } from '../../../components/FormElements';
import { useToast } from '../../../context/ToastContext';
import { formatPrice } from '../../../lib/format';
import type { Expense, RecurringExpense } from '../../../types';
import { useSettings } from '../../settings/hooks/useSettings';
import { MiniKpiRow } from './MiniKpiRow';

function advanceDate(date: string, frequency: RecurringExpense['frequency']): string {
  const d = new Date(date);
  switch (frequency) {
    case 'Hebdomadaire':
      d.setDate(d.getDate() + 7);
      break;
    case 'Mensuel':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'Annuel':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

interface Props {
  onCreateExpense?: (expense: Omit<Expense, 'id'>) => void;
}

export const DepensesRecurrentes: React.FC<Props> = ({ onCreateExpense }) => {
  const { recurringExpenses, updateRecurringExpenses } = useSettings();
  const { addToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newExpense, setNewExpense] = useState({
    name: '',
    amount: 0,
    frequency: 'Mensuel',
    nextDate: new Date().toISOString().slice(0, 10),
  });

  const handleAdd = () => {
    if (!newExpense.name || !newExpense.amount) return;
    updateRecurringExpenses([
      ...recurringExpenses,
      {
        id: crypto.randomUUID(),
        name: newExpense.name,
        amount: Number(newExpense.amount),
        frequency: newExpense.frequency as RecurringExpense['frequency'],
        nextDate: newExpense.nextDate || new Date().toISOString(),
      },
    ]);
    setIsAdding(false);
    setNewExpense({
      name: '',
      amount: 0,
      frequency: 'Mensuel',
      nextDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleDelete = (id: string) => {
    updateRecurringExpenses(recurringExpenses.filter((r) => r.id !== id));
  };

  const handleGenerate = (rec: RecurringExpense) => {
    if (!onCreateExpense) return;
    // Create the expense
    onCreateExpense({
      description: rec.name,
      amount: rec.amount,
      date: rec.nextDate,
      category: '',
    });
    // Advance the next date
    updateRecurringExpenses(
      recurringExpenses.map((r) =>
        r.id === rec.id ? { ...r, nextDate: advanceDate(r.nextDate, r.frequency) } : r,
      ),
    );
    addToast({
      type: 'success',
      message: `Dépense « ${rec.name} » enregistrée. Prochaine échéance avancée.`,
    });
  };

  // Average weeks per month — used to normalize weekly recurring expenses
  // into the monthly KPI. (52 weeks / 12 months = 4.333…)
  const WEEKS_PER_MONTH = 52 / 12;

  // Monthly KPI includes both true-monthly and weekly-normalized-to-monthly
  // recurring expenses. Excluding the weekly ones (M-10) was making the
  // monthly total under-report charges that genuinely repeat every month.
  const monthlyTotal = recurringExpenses.reduce((sum, r) => {
    if (r.frequency === 'Mensuel') return sum + r.amount;
    if (r.frequency === 'Hebdomadaire') return sum + r.amount * WEEKS_PER_MONTH;
    return sum;
  }, 0);
  const annualTotal = recurringExpenses
    .filter((r) => r.frequency === 'Annuel')
    .reduce((sum, r) => sum + r.amount, 0);

  const now = new Date();
  const sortedByDate = [...recurringExpenses]
    .filter((r) => new Date(r.nextDate) >= now)
    .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
  const nextExpense = sortedByDate[0];
  const daysUntilNext = nextExpense
    ? Math.ceil((new Date(nextExpense.nextDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Find overdue recurring expenses (nextDate in the past)
  const overdueExpenses = recurringExpenses.filter((r) => new Date(r.nextDate) < now);

  return (
    <div className="space-y-6">
      {/* Overdue alert */}
      {overdueExpenses.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800">
          <Zap size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {overdueExpenses.length} charge{overdueExpenses.length > 1 ? 's' : ''} en retard
            </p>
            <div className="mt-1 space-y-1">
              {overdueExpenses.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between text-xs">
                  <span>
                    {rec.name} — {formatPrice(rec.amount)} (échue le{' '}
                    {new Date(rec.nextDate).toLocaleDateString('fr-FR')})
                  </span>
                  {onCreateExpense && (
                    <button
                      onClick={() => handleGenerate(rec)}
                      className="text-red-700 hover:text-red-900 font-medium underline ml-2"
                    >
                      Enregistrer
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Next payment alert */}
      {nextExpense && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${daysUntilNext! <= 3 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
        >
          <Zap size={16} className={daysUntilNext! <= 3 ? 'text-amber-500' : 'text-slate-400'} />
          <span className="text-sm font-medium">
            Prochaine {'\u00e9'}ch{'\u00e9'}ance : <strong>{nextExpense.name}</strong> {'\u2014'}{' '}
            {formatPrice(nextExpense.amount)} {'\u2014'} dans {daysUntilNext} jour
            {daysUntilNext! > 1 ? 's' : ''} (
            {new Date(nextExpense.nextDate).toLocaleDateString('fr-FR')})
          </span>
        </div>
      )}

      <MiniKpiRow
        items={[
          { title: 'Charges Mensuelles', value: monthlyTotal, subtitle: '/mois' },
          { title: 'Charges Annuelles', value: annualTotal, subtitle: '/an' },
          { title: 'Nb Charges Actives', value: recurringExpenses.length, format: 'number' },
        ]}
      />

      {/* Add button */}
      <div className="flex justify-end">
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} /> Nouvelle Charge
          </button>
        )}
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-3">Nouvelle charge</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input
              label="Nom"
              value={newExpense.name}
              onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
              placeholder="Ex: Loyer"
            />
            <Input
              label="Montant"
              type="number"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })}
            />
            <Select
              label="Fr\u00e9quence"
              value={newExpense.frequency}
              onChange={(val) => setNewExpense({ ...newExpense, frequency: val as string })}
              options={[
                { value: 'Mensuel', label: 'Mensuel' },
                { value: 'Annuel', label: 'Annuel' },
                { value: 'Hebdomadaire', label: 'Hebdomadaire' },
              ]}
            />
            <Input
              label="Prochaine \u00e9ch\u00e9ance"
              type="date"
              value={newExpense.nextDate}
              onChange={(e) => setNewExpense({ ...newExpense, nextDate: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-semibold text-slate-500 uppercase">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Fr{'\u00e9'}quence</th>
              <th className="px-4 py-3">Prochaine</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recurringExpenses.map((rec) => {
              const isOverdue = new Date(rec.nextDate) < now;
              return (
                <tr
                  key={rec.id}
                  className={`text-sm hover:bg-slate-50 transition-colors group ${isOverdue ? 'bg-red-50/50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{rec.name}</td>
                  <td className="px-4 py-3 text-slate-600 font-medium">
                    {formatPrice(rec.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                      <RefreshCw size={10} /> {rec.frequency}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}
                  >
                    {new Date(rec.nextDate).toLocaleDateString('fr-FR')}
                    {isOverdue && <span className="text-xs ml-1">(en retard)</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onCreateExpense && (
                        <button
                          onClick={() => handleGenerate(rec)}
                          title="Enregistrer comme dépense"
                          className="text-slate-300 hover:text-emerald-600 transition-colors p-1"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="text-slate-300 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {recurringExpenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucune charge r{'\u00e9'}currente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
