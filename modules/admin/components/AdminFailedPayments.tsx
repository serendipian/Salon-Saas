// modules/admin/components/AdminFailedPayments.tsx
import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAdminFailedPayments, useAdminCancelSubscription, type AdminFailedPayment } from '../hooks/useAdmin';

const FailedPaymentRow: React.FC<{ payment: AdminFailedPayment }> = ({ payment }) => {
  const cancel = useAdminCancelSubscription(payment.id);

  const handleCancel = () => {
    if (!window.confirm(`Annuler l'abonnement Stripe de "${payment.name}" ? Le salon passera en Free à la fin de la période en cours.`)) return;
    cancel.mutate();
  };

  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: '1px solid #e3e8ef' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f7fafc')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
    >
      <td className="px-6 py-3 text-[14px] font-semibold" style={{ color: '#1a1f36' }}>{payment.name}</td>
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
          onClick={handleCancel}
          disabled={cancel.isPending || !payment.stripe_subscription_id}
          className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 transition-colors"
          style={{ backgroundColor: '#fff0f0', color: '#df1b41' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ffe4e6')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff0f0')}
        >
          {cancel.isPending ? '...' : 'Annuler abonnement'}
        </button>
      </td>
    </tr>
  );
};

type TabKey = 'failed';

interface Tab {
  key: TabKey;
  label: string;
  count: number;
}

export const AdminFailedPayments: React.FC = () => {
  const { data: payments = [], isLoading } = useAdminFailedPayments();
  const [activeTab, setActiveTab] = useState<TabKey>('failed');

  const tabs: Tab[] = [
    { key: 'failed', label: 'En échec', count: payments.length },
  ];

  const count = payments.length;

  return (
    <div className="p-8" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Paiements échoués</h1>
        <p className="text-[14px] text-[#697386] mt-1">{count} compte{count !== 1 ? 's' : ''} en retard de paiement</p>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
        {/* Status tabs */}
        <div className="flex border-b border-[#e3e8ef]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-3 text-[14px] font-medium transition-colors"
              style={{
                color: activeTab === tab.key ? '#635bff' : '#697386',
                borderBottom: activeTab === tab.key ? '2px solid #635bff' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
              {tab.count > 0 && <span className="ml-1.5 text-[12px]">{tab.count}</span>}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-[14px]" style={{ color: '#697386' }}>
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[14px]" style={{ color: '#697386' }}>Aucun paiement échoué</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#f7fafc', borderBottom: '1px solid #e3e8ef' }}>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Salon</th>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Retard</th>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Fin de période</th>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => <FailedPaymentRow key={p.id} payment={p} />)}
              </tbody>
            </table>
            <div className="px-6 py-3 text-[13px] border-t border-[#e3e8ef]" style={{ color: '#697386' }}>
              {count} élément{count !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
