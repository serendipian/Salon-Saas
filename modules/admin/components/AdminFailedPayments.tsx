// modules/admin/components/AdminFailedPayments.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import {
  useAdminFailedPayments,
  useAdminCancelSubscription,
  type AdminFailedPayment,
} from '../hooks/useAdmin';
import { ADMIN_FONT } from '../constants';
import { AdminLoadingState, AdminErrorState, AdminTableFooter, ConfirmModal } from './AdminShared';

const FailedPaymentRow: React.FC<{ payment: AdminFailedPayment }> = ({ payment }) => {
  const navigate = useNavigate();
  const cancel = useAdminCancelSubscription(payment.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <tr
        onClick={() => navigate(`/admin/accounts/${payment.id}`)}
        className="cursor-pointer hover:bg-[#f7fafc] transition-colors"
        style={{ borderBottom: '1px solid #e3e8ef' }}
      >
        <td className="px-6 py-3 text-[14px] font-semibold" style={{ color: '#1a1f36' }}>
          {payment.name}
        </td>
        <td className="px-6 py-3">
          <span
            className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
            style={{ color: '#df1b41', backgroundColor: '#fff0f0' }}
          >
            {payment.days_overdue}j de retard
          </span>
        </td>
        <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
          {payment.current_period_end
            ? new Date(payment.current_period_end).toLocaleDateString('fr-FR')
            : '–'}
        </td>
        <td className="px-6 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
            disabled={cancel.isPending || !payment.stripe_subscription_id}
            className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#fff0f0', color: '#df1b41' }}
          >
            {cancel.isPending ? (
              <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              'Annuler abonnement'
            )}
          </button>
        </td>
      </tr>
      <ConfirmModal
        isOpen={confirmOpen}
        title="Annuler l'abonnement"
        message={`Annuler l'abonnement Stripe de "${payment.name}" ? Le salon passera en Free à la fin de la période en cours.`}
        confirmLabel="Annuler l'abonnement"
        danger
        onConfirm={() => {
          setConfirmOpen(false);
          cancel.mutate();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export const AdminFailedPayments: React.FC = () => {
  const { data: payments = [], isLoading, isError } = useAdminFailedPayments();
  const count = payments.length;

  return (
    <div className="p-8" style={ADMIN_FONT}>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Paiements échoués</h1>
        <p className="text-[14px] text-[#697386] mt-1">
          {count} compte{count !== 1 ? 's' : ''} en retard de paiement
        </p>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
        {isLoading ? (
          <AdminLoadingState />
        ) : isError ? (
          <AdminErrorState />
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[14px]" style={{ color: '#697386' }}>
              Aucun paiement échoué
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#f7fafc', borderBottom: '1px solid #e3e8ef' }}>
                  <th
                    className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Salon
                  </th>
                  <th
                    className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Retard
                  </th>
                  <th
                    className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Fin de période
                  </th>
                  <th
                    className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <FailedPaymentRow key={p.id} payment={p} />
                ))}
              </tbody>
            </table>
            <AdminTableFooter count={count} />
          </>
        )}
      </div>
    </div>
  );
};
