import { ArrowRightLeft, Banknote, Building2, CreditCard, FileCheck, Tag } from 'lucide-react';
import type React from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { formatPrice } from '../../../lib/format';
import type { Expense, PaymentMethod } from '../../../types';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  especes: { label: 'Espèces', icon: <Banknote size={12} /> },
  carte: { label: 'Carte', icon: <CreditCard size={12} /> },
  virement: { label: 'Virement', icon: <ArrowRightLeft size={12} /> },
  cheque: { label: 'Chèque', icon: <FileCheck size={12} /> },
  prelevement: { label: 'Prélèvement', icon: <Building2 size={12} /> },
};

const FALLBACK_CATEGORY_COLOR = 'bg-slate-100 text-slate-700';

export const ExpenseTable: React.FC<{ expenses: Expense[]; onEdit?: (id: string) => void }> = ({
  expenses,
  onEdit,
}) => {
  if (expenses.length === 0) {
    return <EmptyState title="Aucune dépense trouvée" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
          <tr>
            <th className="px-6 py-4">Date</th>
            <th className="px-6 py-4">Description</th>
            <th className="px-6 py-4 hidden md:table-cell">Fournisseur</th>
            <th className="px-6 py-4 hidden lg:table-cell">Catégorie</th>
            <th className="px-6 py-4 hidden lg:table-cell">Paiement</th>
            <th className="px-6 py-4 text-right">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {expenses.map((exp) => {
            const label = exp.categoryName ?? 'Autre';
            const color = exp.categoryColor ?? FALLBACK_CATEGORY_COLOR;
            const pm = exp.paymentMethod ? PAYMENT_METHOD_LABELS[exp.paymentMethod] : null;

            return (
              <tr
                key={exp.id}
                onClick={() => onEdit?.(exp.id)}
                className={`hover:bg-slate-50/80 transition-colors text-sm group ${onEdit ? 'cursor-pointer' : ''}`}
              >
                <td className="px-6 py-4 text-slate-500 font-medium">
                  {new Date(exp.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 font-bold text-slate-800">{exp.description}</td>
                <td className="px-6 py-4 text-slate-600 hidden md:table-cell">
                  {exp.supplier || '-'}
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-white/20 shadow-sm ${color}`}
                  >
                    <Tag size={12} /> {label}
                  </span>
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  {pm ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                      {pm.icon} {pm.label}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                  {formatPrice(exp.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
