// modules/admin/components/AdminDashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { useAdminMRR, useAdminTrials, useAdminFailedPayments, useAdminRecentSignups } from '../hooks/useAdmin';

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  to?: string;
}> = ({ label, value, icon: Icon, iconBg, iconColor, to }) => {
  const content = (
    <div
      className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 flex items-center gap-4 hover:bg-[#f7fafc] transition-colors"
    >
      <div
        className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div>
        <div
          className="text-[28px] font-bold text-[#1a1f36] leading-none"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#697386] mt-1.5">
          {label}
        </div>
      </div>
    </div>
  );
  if (to) return <Link to={to} className="block">{content}</Link>;
  return content;
};

export const AdminDashboard: React.FC = () => {
  const { data: mrr, isLoading: loadingMRR } = useAdminMRR();
  const { data: trials } = useAdminTrials();
  const { data: failedPayments } = useAdminFailedPayments();
  const { data: signups } = useAdminRecentSignups();

  const activeSubs = (mrr?.premium_count ?? 0) + (mrr?.pro_count ?? 0);
  const expiringThisWeek = (trials ?? []).filter(t => t.days_remaining <= 7).length;

  return (
    <div className="p-8" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Vue d'ensemble</h1>
        <p className="text-[14px] text-[#697386] mt-1">Tableau de bord plateforme</p>
      </div>

      {/* MRR Hero card */}
      <div className="bg-white rounded-[8px] border border-[#e3e8ef] p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#697386] mb-2">
              MRR
            </div>
            {loadingMRR ? (
              <div className="h-10 bg-[#f7fafc] rounded-[6px] animate-pulse w-40" />
            ) : (
              <div
                className="text-[40px] font-bold text-[#1a1f36] leading-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </div>
            )}
            <div className="flex gap-5 mt-4">
              <span className="text-[13px] text-[#697386]">
                <span className="font-semibold text-[#1a1f36]">{mrr?.premium_count ?? '–'}</span>{' '}
                Premium
              </span>
              <span className="text-[13px] text-[#697386]">
                <span className="font-semibold text-[#1a1f36]">{mrr?.pro_count ?? '–'}</span>{' '}
                Pro
              </span>
              <span className="text-[13px] text-[#697386]">
                <span className="font-semibold text-[#1a1f36]">{mrr?.trial_count ?? '–'}</span>{' '}
                Essai
              </span>
              <span className="text-[13px] text-[#697386]">
                <span className="font-semibold text-[#1a1f36]">{mrr?.free_count ?? '–'}</span>{' '}
                Free
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="Abonnements actifs"
          value={activeSubs}
          icon={TrendingUp}
          iconBg="#ede9fe"
          iconColor="#635bff"
          to="/admin/accounts"
        />
        <StatCard
          label="Essais actifs"
          value={mrr?.trial_count ?? '–'}
          icon={Clock}
          iconBg="#e3f2fd"
          iconColor="#1565c0"
          to="/admin/trials"
        />
        <StatCard
          label="Expire cette semaine"
          value={expiringThisWeek}
          icon={Clock}
          iconBg="#fff3e0"
          iconColor="#e65100"
          to="/admin/trials"
        />
        <StatCard
          label="Paiements échoués"
          value={failedPayments?.length ?? '–'}
          icon={AlertCircle}
          iconBg="#ffebee"
          iconColor="#df1b41"
          to="/admin/billing"
        />
        <StatCard
          label="Inscriptions (30j)"
          value={signups?.length ?? '–'}
          icon={UserPlus}
          iconBg="#e8f5e9"
          iconColor="#24b47e"
          to="/admin/signups"
        />
        <StatCard
          label="Total salons"
          value={mrr?.total_salons ?? '–'}
          icon={Users}
          iconBg="#f7fafc"
          iconColor="#697386"
          to="/admin/accounts"
        />
      </div>
    </div>
  );
};
