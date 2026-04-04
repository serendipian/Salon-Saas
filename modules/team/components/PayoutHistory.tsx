import React from 'react';
import { Check, X } from 'lucide-react';
import type { StaffPayout } from '../../../types';
import { formatPrice } from '../../../lib/format';

interface PayoutHistoryProps {
  payouts: StaffPayout[];
  onMarkAsPaid: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}

const TYPE_LABELS: Record<string, string> = {
  SALARY: 'Salaire',
  COMMISSION: 'Commission',
  BONUS: 'Prime',
  OTHER: 'Autre',
};

function formatPeriod(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${fmt(start)} — ${fmt(end)}`;
}

export const PayoutHistory: React.FC<PayoutHistoryProps> = ({ payouts, onMarkAsPaid, onCancel }) => {
  if (payouts.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        Aucun paiement enregistré
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Période</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                {formatPeriod(p.periodStart, p.periodEnd)}
              </td>
              <td className="py-2.5 px-3 text-slate-700">
                {TYPE_LABELS[p.type] || p.type}
              </td>
              <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                {formatPrice(p.amount)}
              </td>
              <td className="py-2.5 px-3">
                {p.status === 'PENDING' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    En attente
                  </span>
                )}
                {p.status === 'PAID' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Payé
                  </span>
                )}
                {p.status === 'CANCELLED' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 line-through">
                    Annulé
                  </span>
                )}
              </td>
              <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate">
                {p.notes || '—'}
              </td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                {p.status === 'PENDING' && (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onMarkAsPaid(p.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Marquer payé"
                    >
                      <Check size={14} />
                      Payé
                    </button>
                    <button
                      onClick={() => onCancel(p.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Annuler"
                    >
                      <X size={14} />
                      Annuler
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
