// modules/admin/components/AdminDashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { useAdminMRR, useAdminTrials, useAdminFailedPayments, useAdminRecentSignups } from '../hooks/useAdmin';

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  iconClass: string;
  to?: string;
}> = ({ label, value, icon: Icon, iconClass, to }) => {
  const content = (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-900">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard Admin</h1>
        <p className="text-sm text-slate-500 mt-1">Vue d'ensemble de la plateforme</p>
      </div>

      {/* MRR Hero */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 mb-6">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">MRR Total</div>
        {loadingMRR ? (
          <div className="h-10 bg-slate-700 rounded animate-pulse w-40" />
        ) : (
          <div className="text-4xl font-extrabold">
            {(mrr?.total_mrr ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </div>
        )}
        <div className="flex gap-6 mt-4 text-sm text-slate-400">
          <span><span className="text-white font-semibold">{mrr?.premium_count ?? '–'}</span> Premium</span>
          <span><span className="text-white font-semibold">{mrr?.pro_count ?? '–'}</span> Pro</span>
          <span><span className="text-white font-semibold">{mrr?.trial_count ?? '–'}</span> Essai</span>
          <span><span className="text-white font-semibold">{mrr?.free_count ?? '–'}</span> Free</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Abonnements actifs"
          value={activeSubs}
          icon={TrendingUp}
          iconClass="bg-brand-100 text-brand-600"
          to="/admin/accounts"
        />
        <StatCard
          label="Essais actifs"
          value={mrr?.trial_count ?? '–'}
          icon={Clock}
          iconClass="bg-blue-100 text-blue-600"
          to="/admin/trials"
        />
        <StatCard
          label="Essais expirant cette semaine"
          value={expiringThisWeek}
          icon={Clock}
          iconClass="bg-amber-100 text-amber-600"
          to="/admin/trials"
        />
        <StatCard
          label="Paiements échoués"
          value={failedPayments?.length ?? '–'}
          icon={AlertCircle}
          iconClass="bg-rose-100 text-rose-600"
          to="/admin/billing"
        />
        <StatCard
          label="Nouvelles inscriptions (30j)"
          value={signups?.length ?? '–'}
          icon={UserPlus}
          iconClass="bg-emerald-100 text-emerald-600"
          to="/admin/signups"
        />
        <StatCard
          label="Total salons"
          value={mrr?.total_salons ?? '–'}
          icon={Users}
          iconClass="bg-slate-100 text-slate-600"
          to="/admin/accounts"
        />
      </div>
    </div>
  );
};
