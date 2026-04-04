// modules/admin/components/AdminFailedPayments.tsx
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useAdminFailedPayments, useAdminCancelSubscription, type AdminFailedPayment } from '../hooks/useAdmin';

const CARD_SHADOW = '0 2px 5px 0 rgba(60,66,87,.08), 0 0 0 1px rgba(60,66,87,.16)';

const FailedPaymentRow: React.FC<{ payment: AdminFailedPayment }> = ({ payment }) => {
  const cancel = useAdminCancelSubscription(payment.id);

  const handleCancel = () => {
    if (!window.confirm(`Annuler l'abonnement Stripe de "${payment.name}" ? Le salon passera en Free à la fin de la période en cours.`)) return;
    cancel.mutate();
  };

  return (
    <tr className="hover:bg-[#f6f9fc] transition-colors border-b border-[#f6f9fc] last:border-0">
      <td className="px-6 py-3.5 text-[13px] font-semibold text-[#30313d]">{payment.name}</td>
      <td className="px-4 py-3.5">
        <span
          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ color: '#df1b41', backgroundColor: '#fff0f0' }}
        >
          {payment.days_overdue}j de retard
        </span>
      </td>
      <td className="px-4 py-3.5 text-[13px] text-[#6b7c93]">
        {payment.current_period_end
          ? new Date(payment.current_period_end).toLocaleDateString('fr-FR')
          : '–'}
      </td>
      <td className="px-4 py-3.5">
        <button
          onClick={handleCancel}
          disabled={cancel.isPending || !payment.stripe_subscription_id}
          className="h-8 px-3 text-[12px] font-semibold bg-[#fff0f0] text-[#df1b41] rounded-[6px] hover:bg-[#ffe4e6] disabled:opacity-50 transition-colors"
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
    <div className="p-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#30313d]">Paiements échoués</h1>
        <p className="text-[13px] text-[#6b7c93] mt-0.5">{payments.length} compte(s) en retard de paiement</p>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-[13px] text-[#6b7c93]">
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[13px] text-[#6b7c93]">Aucun paiement échoué</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f9fc] border-b border-[#e3e8ef]">
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Salon</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Retard</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Fin de période</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Action</th>
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
