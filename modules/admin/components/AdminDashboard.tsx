// modules/admin/components/AdminDashboard.tsx

import { Info } from 'lucide-react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import { ADMIN_FONT } from '../constants';
import {
  type AdminHistoryPoint,
  useAdminFailedPayments,
  useAdminMRR,
  useAdminMRRHistory,
  useAdminSignupsHistory,
  useAdminTrialsHistory,
} from '../hooks/useAdmin';
import { AdminErrorState } from './AdminShared';

const SparkTooltip: React.FC<any> = ({ active, payload, isCurrency }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as AdminHistoryPoint;
  const date = new Date(point.month);
  const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const val = payload[0].value ?? 0;
  const formatted = isCurrency
    ? val.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    : val.toLocaleString('fr-FR');
  return (
    <div
      style={{
        backgroundColor: '#1a1f36',
        border: 'none',
        borderRadius: 6,
        padding: '6px 10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{formatted}</div>
      <div style={{ color: '#a3acbe', fontSize: 11, marginTop: 1 }}>{label}</div>
    </div>
  );
};

// Unique gradient IDs per sparkline to avoid SVG defs collision
const MiniSparkline: React.FC<{
  data: AdminHistoryPoint[];
  gradId: string;
  isCurrency?: boolean;
}> = ({ data, gradId, isCurrency }) => (
  <ResponsiveContainer width="100%" height={80}>
    <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#635bff" stopOpacity={0.15} />
          <stop offset="95%" stopColor="#635bff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <Tooltip
        content={<SparkTooltip isCurrency={isCurrency} />}
        cursor={{ stroke: '#635bff', strokeWidth: 1, strokeDasharray: '3 3' }}
      />
      <Area
        type="monotone"
        dataKey="value"
        stroke="#635bff"
        strokeWidth={1.5}
        fill={`url(#${gradId})`}
        dot={false}
        activeDot={{ r: 3, fill: '#635bff', stroke: '#fff', strokeWidth: 2 }}
        isAnimationActive={false}
      />
    </AreaChart>
  </ResponsiveContainer>
);

const EmptyChart: React.FC = () => (
  <div
    className="w-full h-[80px] rounded-[6px] flex items-center justify-center"
    style={{ border: '1.5px dashed #e3e8ef' }}
  >
    <span className="text-[13px]" style={{ color: '#c1cfe0' }}>
      Aucune donnée
    </span>
  </div>
);

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  to?: string;
  loading?: boolean;
  chartData?: AdminHistoryPoint[];
  gradId?: string;
  isCurrency?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  to,
  loading,
  chartData,
  gradId,
  isCurrency,
}) => {
  const inner = (
    <div className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 flex flex-col h-full transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[13px] font-medium" style={{ color: '#3c4257' }}>
          {title}
        </span>
        <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#c1cfe0' }} />
      </div>
      {loading ? (
        <div className="h-8 w-32 bg-[#f7fafc] rounded-[4px] animate-pulse mb-1" />
      ) : (
        <div
          className="text-[28px] font-bold leading-none mb-1"
          style={{ color: '#1a1f36', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </div>
      )}
      {subtitle && (
        <div className="text-[13px] mb-2" style={{ color: '#697386' }}>
          {subtitle}
        </div>
      )}
      <div className="flex-1 mt-2">
        {loading ? (
          <div className="w-full h-[80px] bg-[#f7fafc] rounded-[6px] animate-pulse" />
        ) : chartData && chartData.length > 0 && gradId ? (
          <MiniSparkline data={chartData} gradId={gradId} isCurrency={isCurrency} />
        ) : (
          <EmptyChart />
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
        <span className="text-[11px]" style={{ color: '#c1cfe0' }}>
          Mis à jour il y a quelques secondes
        </span>
        <span className="text-[11px] cursor-pointer hover:underline" style={{ color: '#635bff' }}>
          Plus d'informations
        </span>
      </div>
    </div>
  );
  if (to)
    return (
      <Link to={to} className="block h-full">
        {inner}
      </Link>
    );
  return inner;
};

export const AdminDashboard: React.FC = () => {
  const { data: mrr, isLoading: loadingMRR, isError: errorMRR } = useAdminMRR();
  const { data: mrrHistory, isLoading: loadingMRRHistory } = useAdminMRRHistory();
  const { data: signupsHistory, isLoading: loadingSignups } = useAdminSignupsHistory();
  const { data: trialsHistory, isLoading: loadingTrials } = useAdminTrialsHistory();
  const { data: failedPayments } = useAdminFailedPayments();

  const activeSubs = (mrr?.premium_count ?? 0) + (mrr?.pro_count ?? 0);

  return (
    <div className="p-8" style={ADMIN_FONT}>
      <h1 className="text-[28px] font-bold mb-8" style={{ color: '#1a1f36' }}>
        Vue d'ensemble
      </h1>

      {errorMRR && <AdminErrorState message="Impossible de charger les données MRR." />}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard
          title="MRR"
          value={(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR',
          })}
          subtitle={`${mrr?.premium_count ?? 0} premium · ${mrr?.pro_count ?? 0} pro · ${mrr?.trial_count ?? 0} essai`}
          loading={loadingMRR || loadingMRRHistory}
          chartData={mrrHistory}
          gradId="spark-mrr"
          isCurrency
        />
        <MetricCard
          title="Abonnements actifs"
          value={activeSubs}
          subtitle={`${mrr?.trial_count ?? 0} en essai · ${mrr?.free_count ?? 0} en free`}
          loading={loadingMRR || loadingMRRHistory}
          chartData={mrrHistory}
          gradId="spark-subs"
          to="/admin/accounts"
        />
        <MetricCard
          title="Total salons"
          value={mrr?.total_salons ?? 0}
          subtitle={`${mrr?.premium_count ?? 0} premium · ${mrr?.pro_count ?? 0} pro · ${mrr?.free_count ?? 0} free`}
          loading={loadingMRR || loadingSignups}
          chartData={signupsHistory}
          gradId="spark-total"
          to="/admin/accounts"
        />
        <MetricCard
          title="Essais actifs"
          value={mrr?.trial_count ?? 0}
          subtitle={`${mrr?.trial_count ?? 0} essai${(mrr?.trial_count ?? 0) !== 1 ? 's' : ''} en cours`}
          loading={loadingMRR || loadingTrials}
          chartData={trialsHistory}
          gradId="spark-trials"
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
          value={signupsHistory?.at(-1)?.value ?? 0}
          subtitle="Salons inscrits ce mois"
          loading={loadingSignups}
          chartData={signupsHistory}
          gradId="spark-signups"
          to="/admin/signups"
        />
      </div>
    </div>
  );
};
