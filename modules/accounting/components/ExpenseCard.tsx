import React from 'react';
import { Tag, Banknote, CreditCard, Building2, FileCheck, ArrowRightLeft } from 'lucide-react';
import { Expense, PaymentMethod } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { EmptyState } from '../../../components/EmptyState';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  especes: { label: 'Espèces', icon: <Banknote size={12} /> },
  carte: { label: 'Carte', icon: <CreditCard size={12} /> },
  virement: { label: 'Virement', icon: <ArrowRightLeft size={12} /> },
  cheque: { label: 'Chèque', icon: <FileCheck size={12} /> },
  prelevement: { label: 'Prélèvement', icon: <Building2 size={12} /> },
};

const FALLBACK_CATEGORY_COLOR = 'bg-slate-100 text-slate-700';

export const ExpenseCard: React.FC<{ expenses: Expense[]; onEdit?: (id: string) => void }> = ({
  expenses,
  onEdit,
}) => {
  if (expenses.length === 0) {
    return <EmptyState title="Aucune dépense trouvée" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {expenses.map((exp) => {
        const label = exp.categoryName ?? 'Autre';
        const color = exp.categoryColor ?? FALLBACK_CATEGORY_COLOR;
        const pm = exp.paymentMethod ? PAYMENT_METHOD_LABELS[exp.paymentMethod] : null;

        return (
          <div
            key={exp.id}
            onClick={() => onEdit?.(exp.id)}
            className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 group animate-in fade-in ${onEdit ? 'cursor-pointer hover:border-slate-300 hover:shadow-md transition-all' : ''}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{exp.description}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(exp.date).toLocaleDateString()}
                </p>
              </div>
              <span className="font-bold text-slate-900 text-sm shrink-0">
                {formatPrice(exp.amount)}
              </span>
            </div>

            {exp.supplier && <p className="text-xs text-slate-600 mb-2">{exp.supplier}</p>}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-white/20 shadow-sm ${color}`}
              >
                <Tag size={12} /> {label}
              </span>
              {pm && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                  {pm.icon} {pm.label}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
