import React, { useState } from 'react';
import { Plus, Trash2, RefreshCw, Zap, Info } from 'lucide-react';
import { useSettings } from '../../settings/hooks/useSettings';
import { Input, Select } from '../../../components/FormElements';
import { MiniKpiRow } from './MiniKpiRow';
import { formatPrice } from '../../../lib/format';
import type { RecurringExpense } from '../../../types';

export const DepensesRecurrentes: React.FC = () => {
  const { recurringExpenses, updateRecurringExpenses } = useSettings();
  const [isAdding, setIsAdding] = useState(false);
  const [newExpense, setNewExpense] = useState({ name: '', amount: 0, frequency: 'Mensuel', nextDate: new Date().toISOString().slice(0, 10) });

  const handleAdd = () => {
    if (!newExpense.name || !newExpense.amount) return;
    updateRecurringExpenses([...recurringExpenses, {
      id: crypto.randomUUID(),
      name: newExpense.name,
      amount: Number(newExpense.amount),
      frequency: newExpense.frequency as RecurringExpense['frequency'],
      nextDate: newExpense.nextDate || new Date().toISOString(),
    }]);
    setIsAdding(false);
    setNewExpense({ name: '', amount: 0, frequency: 'Mensuel', nextDate: new Date().toISOString().slice(0, 10) });
  };

  const handleDelete = (id: string) => {
    updateRecurringExpenses(recurringExpenses.filter(r => r.id !== id));
  };

  const monthlyTotal = recurringExpenses.filter(r => r.frequency === 'Mensuel').reduce((sum, r) => sum + r.amount, 0);
  const annualTotal = recurringExpenses.filter(r => r.frequency === 'Annuel').reduce((sum, r) => sum + r.amount, 0);

  const now = new Date();
  const sortedByDate = [...recurringExpenses].filter(r => new Date(r.nextDate) >= now).sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());
  const nextExpense = sortedByDate[0];
  const daysUntilNext = nextExpense ? Math.ceil((new Date(nextExpense.nextDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-6">
      {/* Next payment alert */}
      {nextExpense && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${daysUntilNext! <= 3 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          <Zap size={16} className={daysUntilNext! <= 3 ? 'text-amber-500' : 'text-slate-400'} />
          <span className="text-sm font-medium">
            Prochaine {'\u00e9'}ch{'\u00e9'}ance : <strong>{nextExpense.name}</strong> {'\u2014'} {formatPrice(nextExpense.amount)} {'\u2014'} dans {daysUntilNext} jour{daysUntilNext! > 1 ? 's' : ''} ({new Date(nextExpense.nextDate).toLocaleDateString('fr-FR')})
          </span>
        </div>
      )}

      <MiniKpiRow items={[
        { title: 'Charges Mensuelles', value: monthlyTotal, subtitle: '/mois' },
        { title: 'Charges Annuelles', value: annualTotal, subtitle: '/an' },
        { title: 'Nb Charges Actives', value: recurringExpenses.length, format: 'number' },
      ]} />

      {/* Info banner */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>Les charges r{'\u00e9'}currentes sont un aide-m{'\u00e9'}moire. Saisissez-les dans {'\u00ab'} Courantes {'\u00bb'} {'\u00e0'} chaque {'\u00e9'}ch{'\u00e9'}ance.</span>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all">
            <Plus size={16} /> Nouvelle Charge
          </button>
        )}
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-3">Nouvelle charge</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input label="Nom" value={newExpense.name} onChange={e => setNewExpense({ ...newExpense, name: e.target.value })} placeholder="Ex: Loyer" />
            <Input label="Montant" type="number" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })} />
            <Select label="Fr\u00e9quence" value={newExpense.frequency} onChange={(val) => setNewExpense({ ...newExpense, frequency: val as string })} options={[
              { value: 'Mensuel', label: 'Mensuel' },
              { value: 'Annuel', label: 'Annuel' },
              { value: 'Hebdomadaire', label: 'Hebdomadaire' },
            ]} />
            <Input label="Prochaine \u00e9ch\u00e9ance" type="date" value={newExpense.nextDate} onChange={e => setNewExpense({ ...newExpense, nextDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleAdd} className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800">Confirmer</button>
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
            {recurringExpenses.map(rec => (
              <tr key={rec.id} className="text-sm hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-3 font-medium text-slate-900">{rec.name}</td>
                <td className="px-4 py-3 text-slate-600 font-medium">{formatPrice(rec.amount)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                    <RefreshCw size={10} /> {rec.frequency}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(rec.nextDate).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(rec.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {recurringExpenses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Aucune charge r{'\u00e9'}currente</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
