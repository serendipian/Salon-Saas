// modules/admin/components/AdminFailedPayments.tsx
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useAdminFailedPayments, useAdminCancelSubscription, type AdminFailedPayment } from '../hooks/useAdmin';

const FailedPaymentRow: React.FC<{ payment: AdminFailedPayment }> = ({ payment }) => {
  const cancel = useAdminCancelSubscription(payment.id);

  const handleCancel = () => {
    if (!window.confirm(`Annuler l'abonnement Stripe de "${payment.name}" ? Le salon passera en Free à la fin de la période en cours.`)) return;
    cancel.mutate();
  };

  return (
    <tr className="border-b border-slate-50">
      <td className="px-6 py-3 font-semibold text-slate-900">{payment.name}</td>
      <td className="px-4 py-3">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
          {payment.days_overdue}j de retard
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500 text-sm">
        {payment.current_period_end
          ? new Date(payment.current_period_end).toLocaleDateString('fr-FR')
          : '–'}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleCancel}
          disabled={cancel.isPending || !payment.stripe_subscription_id}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
        >
          {cancel.isPending ? '...' : 'Annuler abonnement'}
        </button>
      </td>
    </tr>
  );
};

export const AdminFailedPayments: React.FC = () => {
  const { data: payments = [], isLoading } = useAdminFailedPayments();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Paiements échoués</h1>
        <p className="text-sm text-slate-500 mt-1">{payments.length} compte(s) en retard de paiement</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucun paiement échoué</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Retard</th>
                <th className="text-left px-4 py-3">Fin de période</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => <FailedPaymentRow key={p.id} payment={p} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
