// modules/admin/components/AdminDashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useAdminMRR, useAdminTrials, useAdminFailedPayments, useAdminRecentSignups } from '../hooks/useAdmin';
import { ADMIN_FONT } from '../constants';
import { AdminErrorState } from './AdminShared';

const EmptyChart: React.FC = () => (
  <div
    className="w-full h-[110px] rounded-[6px] flex items-center justify-center"
    style={{ border: '1.5px dashed #e3e8ef' }}
  >
    <span className="text-[13px]" style={{ color: '#c1cfe0' }}>Aucune donnée</span>
  </div>
);

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  to?: string;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, to, loading }) => {
  const inner = (
    <div className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 flex flex-col h-full transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[13px] font-medium" style={{ color: '#3c4257' }}>{title}</span>
        <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#c1cfe0' }} />
      </div>
      {loading ? (
        <div className="h-8 w-32 bg-[#f7fafc] rounded-[4px] animate-pulse mb-1" />
      ) : (
        <div className="text-[28px] font-bold leading-none mb-1" style={{ color: '#1a1f36', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
      )}
      {subtitle && <div className="text-[13px] mb-4" style={{ color: '#697386' }}>{subtitle}</div>}
      <div className="flex-1 mt-2">
        {loading ? <div className="w-full h-[110px] bg-[#f7fafc] rounded-[6px] animate-pulse" /> : <EmptyChart />}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
        <span className="text-[11px]" style={{ color: '#c1cfe0' }}>Mis à jour il y a quelques secondes</span>
        <span className="text-[11px] cursor-pointer hover:underline" style={{ color: '#635bff' }}>Plus d'informations</span>
      </div>
    </div>
  );
  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  return inner;
};

export const AdminDashboard: React.FC = () => {
  const { data: mrr, isLoading: loadingMRR, isError: errorMRR } = useAdminMRR();
  const { data: trials } = useAdminTrials();
  const { data: failedPayments } = useAdminFailedPayments();
  const { data: signups } = useAdminRecentSignups();

  const activeSubs = (mrr?.premium_count ?? 0) + (mrr?.pro_count ?? 0);
  const expiringThisWeek = (trials ?? []).filter(t => t.days_remaining <= 7).length;

  return (
    <div className="p-8" style={ADMIN_FONT}>
      <h1 className="text-[28px] font-bold mb-8" style={{ color: '#1a1f36' }}>Vue d'ensemble</h1>

      {errorMRR && <AdminErrorState message="Impossible de charger les données MRR." />}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard
          title="MRR"
          value={(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          subtitle={`${mrr?.premium_count ?? 0} premium · ${mrr?.pro_count ?? 0} pro · ${mrr?.trial_count ?? 0} essai`}
          loading={loadingMRR}
        />
        <MetricCard
          title="Abonnements actifs"
          value={activeSubs}
          subtitle={`${mrr?.trial_count ?? 0} en essai · ${mrr?.free_count ?? 0} en free`}
          loading={loadingMRR}
          to="/admin/accounts"
        />
        <MetricCard
          title="Total salons"
          value={mrr?.total_salons ?? 0}
          subtitle={`${mrr?.premium_count ?? 0} premium · ${mrr?.pro_count ?? 0} pro · ${mrr?.free_count ?? 0} free`}
          loading={loadingMRR}
          to="/admin/accounts"
        />
        <MetricCard
          title="Essais actifs"
          value={mrr?.trial_count ?? 0}
          subtitle={`${expiringThisWeek} expire(nt) cette semaine`}
          loading={loadingMRR}
          to="/admin/trials"
        />
        <MetricCard
          title="Paiements échoués"
          value={failedPayments?.length ?? 0}
          subtitle="Comptes en retard de paiement"
          to="/admin/billing"
        />
        <MetricCard
          title="Nouvelles inscriptions (30j)"
          value={signups?.length ?? 0}
          subtitle="Salons inscrits ce mois"
          to="/admin/signups"
        />
      </div>
    </div>
  );
};
