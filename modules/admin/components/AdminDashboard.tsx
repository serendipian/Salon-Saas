// modules/admin/components/AdminDashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Info, ChevronDown, Plus, Pencil, X } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useAdminMRR, useAdminTrials, useAdminFailedPayments, useAdminRecentSignups } from '../hooks/useAdmin';

const FONT = { fontFamily: "'Inter', -apple-system, sans-serif" };

// Stripe-style "Aucune donnée" empty chart
const EmptyChart: React.FC = () => (
  <div
    className="w-full h-[110px] rounded-[6px] flex items-center justify-center"
    style={{ border: '1.5px dashed #e3e8ef', backgroundColor: 'transparent' }}
  >
    <span className="text-[13px]" style={{ color: '#c1cfe0' }}>Aucune donnée</span>
  </div>
);

// Mini sparkline using Recharts
const MiniChart: React.FC<{ data: { v: number }[]; color?: string }> = ({ data, color = '#635bff' }) => (
  <div className="w-full h-[110px]">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <Tooltip
          contentStyle={{ fontSize: 12, border: '1px solid #e3e8ef', borderRadius: 6, color: '#1a1f36' }}
          itemStyle={{ color }}
          formatter={(v: number) => [v, '']}
          labelFormatter={() => ''}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  chart?: React.ReactNode;
  to?: string;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, chart, to, loading }) => {
  const inner = (
    <div
      className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 flex flex-col h-full transition-shadow hover:shadow-sm"
      style={FONT}
    >
      {/* Title row */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[13px] font-medium" style={{ color: '#3c4257' }}>{title}</span>
        <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#c1cfe0' }} />
      </div>

      {/* Value */}
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

      {/* Subtitle */}
      {subtitle && (
        <div className="text-[13px] mb-4" style={{ color: '#697386' }}>{subtitle}</div>
      )}

      {/* Chart area */}
      <div className="flex-1 mt-2">
        {loading ? (
          <div className="w-full h-[110px] bg-[#f7fafc] rounded-[6px] animate-pulse" />
        ) : (
          chart ?? <EmptyChart />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
        <span className="text-[11px]" style={{ color: '#c1cfe0' }}>Mis à jour il y a quelques secondes</span>
        <span className="text-[11px] cursor-pointer hover:underline" style={{ color: '#635bff' }}>
          Plus d'informations
        </span>
      </div>
    </div>
  );

  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  return inner;
};

// Date-range pill button
const Pill: React.FC<{ label: string; withX?: boolean; withChevron?: boolean }> = ({ label, withX, withChevron }) => (
  <button
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] border border-[#e3e8ef] rounded-full hover:bg-[#f7fafc] transition-colors"
    style={{ color: '#3c4257', ...FONT }}
  >
    {withX && <X className="w-3 h-3" style={{ color: '#697386' }} />}
    {label}
    {withChevron && <ChevronDown className="w-3 h-3" style={{ color: '#697386' }} />}
  </button>
);

export const AdminDashboard: React.FC = () => {
  const { data: mrr, isLoading: loadingMRR } = useAdminMRR();
  const { data: trials } = useAdminTrials();
  const { data: failedPayments } = useAdminFailedPayments();
  const { data: signups } = useAdminRecentSignups();

  const activeSubs = (mrr?.premium_count ?? 0) + (mrr?.pro_count ?? 0);
  const expiringThisWeek = (trials ?? []).filter(t => t.days_remaining <= 7).length;
  const totalSalons = mrr?.total_salons ?? 0;

  // Simple sparkline data — flat line at current value (no time-series available)
  const mrrData = [{ v: 0 }, { v: 0 }, { v: 0 }, { v: mrr?.total_mrr ?? 0 }];
  const subsData = [{ v: 0 }, { v: 0 }, { v: activeSubs }];
  const salonsData = Array.from({ length: 5 }, (_, i) => ({ v: i === 4 ? totalSalons : Math.max(0, totalSalons - (4 - i)) }));
  const signupsData = [{ v: 0 }, { v: 0 }, { v: signups?.length ?? 0 }];

  return (
    <div className="p-8" style={FONT}>
      {/* Page header */}
      <h1 className="text-[28px] font-bold mb-6" style={{ color: '#1a1f36' }}>Votre aperçu</h1>

      {/* Date range + action bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Pill label="Plage de dates · Ce mois-ci" withChevron />
        <Pill label="Par mois" withChevron />
        <Pill label="Comparer · Période précédente" withX withChevron />
        <div className="flex-1" />
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] border border-[#e3e8ef] rounded-[6px] hover:bg-[#f7fafc] transition-colors"
          style={{ color: '#3c4257' }}
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] border border-[#e3e8ef] rounded-[6px] hover:bg-[#f7fafc] transition-colors"
          style={{ color: '#3c4257' }}
        >
          <Pencil className="w-3.5 h-3.5" /> Modifier
        </button>
      </div>

      {/* Metric cards grid — 3 columns like Stripe */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard
          title="MRR"
          value={(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          subtitle="0,00 € période précédente"
          chart={<MiniChart data={mrrData} />}
          loading={loadingMRR}
        />

        <MetricCard
          title="Volume brut"
          value={(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          subtitle="0,00 € période précédente"
          chart={<MiniChart data={mrrData} />}
          loading={loadingMRR}
          to="/admin/accounts"
        />

        <MetricCard
          title="Abonnements actifs"
          value={activeSubs}
          subtitle={`${mrr?.trial_count ?? 0} en essai · ${mrr?.free_count ?? 0} en free`}
          chart={activeSubs > 0 ? <MiniChart data={subsData} color="#24b47e" /> : undefined}
          loading={loadingMRR}
          to="/admin/accounts"
        />

        <MetricCard
          title="Essais actifs"
          value={mrr?.trial_count ?? 0}
          subtitle={`${expiringThisWeek} expire(nt) cette semaine`}
          chart={<EmptyChart />}
          loading={loadingMRR}
          to="/admin/trials"
        />

        <MetricCard
          title="Paiements échoués"
          value={failedPayments?.length ?? 0}
          subtitle="0 période précédente"
          to="/admin/billing"
        />

        <MetricCard
          title="Nouveaux clients (30j)"
          value={signups?.length ?? 0}
          subtitle="0 période précédente"
          chart={(signups?.length ?? 0) > 0 ? <MiniChart data={signupsData} color="#1565c0" /> : undefined}
          to="/admin/signups"
        />

        <MetricCard
          title="Total salons"
          value={totalSalons}
          subtitle={`${mrr?.premium_count ?? 0} premium · ${mrr?.pro_count ?? 0} pro`}
          chart={totalSalons > 0 ? <MiniChart data={salonsData} color="#635bff" /> : undefined}
          loading={loadingMRR}
          to="/admin/accounts"
        />

        <MetricCard
          title="Résiliations"
          value={0}
          subtitle="0 période précédente"
          to="/admin/churn"
        />

        <MetricCard
          title="Volume net"
          value={(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          subtitle="0,00 € période précédente"
          chart={<MiniChart data={mrrData} color="#24b47e" />}
          loading={loadingMRR}
        />
      </div>
    </div>
  );
};
