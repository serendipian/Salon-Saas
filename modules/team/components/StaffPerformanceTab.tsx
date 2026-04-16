// modules/team/components/StaffPerformanceTab.tsx

import {
  BarChart2,
  CalendarCheck,
  CalendarX,
  Scissors,
  ShoppingBag,
  TrendingUp,
  UserX,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { DateRangePicker } from '../../../components/DateRangePicker';
import { SafeResponsiveContainer as ResponsiveContainer } from '../../../components/SafeResponsiveContainer';
import { useTransactions } from '../../../hooks/useTransactions';
import { formatPrice } from '../../../lib/format';
import type { CartItem, DateRange, Transaction } from '../../../types';
import { useAppointments } from '../../appointments/hooks/useAppointments';

interface StaffPerformanceTabProps {
  staffId: string;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export const StaffPerformanceTab: React.FC<StaffPerformanceTabProps> = ({ staffId }) => {
  const { allAppointments: appointments } = useAppointments();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      label: 'Ce mois-ci',
    };
  });

  const perfRange = useMemo(
    () => ({
      from: new Date(dateRange.from).toISOString(),
      to: new Date(dateRange.to).toISOString(),
    }),
    [dateRange],
  );

  const { transactions } = useTransactions(perfRange);

  const revenueStats = useMemo(() => {
    let serviceRevenue = 0;
    let productRevenue = 0;
    const txIds = new Set<string>();
    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    const dailyMap = new Map<string, number>();

    transactions.forEach((t: Transaction) => {
      const staffItems = (t.items || []).filter((i: CartItem) => i.staffId === staffId);
      if (staffItems.length === 0) return;
      txIds.add(t.id);

      const dayKey = new Date(t.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });

      staffItems.forEach((item: CartItem) => {
        const amount = item.price * (item.quantity || 1);
        if (item.type === 'SERVICE') {
          serviceRevenue += amount;
          const key = item.referenceId || item.name;
          if (!serviceMap.has(key)) serviceMap.set(key, { name: item.name, count: 0, revenue: 0 });
          serviceMap.get(key)!.count += item.quantity || 1;
          serviceMap.get(key)!.revenue += amount;
        } else {
          productRevenue += amount;
        }
        dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + amount);
      });
    });

    const totalRevenue = serviceRevenue + productRevenue;
    const avgBasket = txIds.size > 0 ? totalRevenue / txIds.size : 0;
    const topServices = [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const chartData: { name: string; ca: number }[] = [];
    const cur = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    while (cur <= end) {
      const key = cur.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      chartData.push({ name: key, ca: dailyMap.get(key) || 0 });
      cur.setDate(cur.getDate() + 1);
    }

    return {
      totalRevenue,
      serviceRevenue,
      productRevenue,
      avgBasket,
      txCount: txIds.size,
      topServices,
      chartData,
    };
  }, [transactions, staffId, dateRange]);

  const appointmentStats = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const staffAppts = appointments.filter((a) => {
      if (a.staffId !== staffId) return false;
      const time = new Date(a.date).getTime();
      return time >= from && time <= to;
    });
    const completed = staffAppts.filter((a) => a.status === 'COMPLETED').length;
    const cancelled = staffAppts.filter((a) => a.status === 'CANCELLED').length;
    const noShow = staffAppts.filter((a) => a.status === 'NO_SHOW').length;
    const resolved = completed + cancelled + noShow;
    const total = staffAppts.length;
    return { completed, cancelled, noShow, resolved, total };
  }, [appointments, staffId, dateRange]);

  const cancellationRate =
    appointmentStats.resolved > 0
      ? ((appointmentStats.cancelled / appointmentStats.resolved) * 100).toFixed(1)
      : '0';
  const noShowRate =
    appointmentStats.resolved > 0
      ? ((appointmentStats.noShow / appointmentStats.resolved) * 100).toFixed(1)
      : '0';

  const daysDiff = Math.ceil(
    (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24),
  );
  const showChart = daysDiff <= 31;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <h2 className="text-lg font-bold text-slate-900">Performance</h2>
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
      </div>

      {/* Revenue KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp}
          label="CA total"
          value={formatPrice(revenueStats.totalRevenue)}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <KpiCard
          icon={Scissors}
          label="CA prestations"
          value={formatPrice(revenueStats.serviceRevenue)}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
        />
        <KpiCard
          icon={ShoppingBag}
          label="CA produits"
          value={formatPrice(revenueStats.productRevenue)}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KpiCard
          icon={BarChart2}
          label="Panier moyen"
          value={revenueStats.txCount > 0 ? formatPrice(revenueStats.avgBasket) : '\u2014'}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
      </div>

      {/* Appointment KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard
          icon={CalendarCheck}
          label="RDV effectués"
          value={String(appointmentStats.completed)}
          sub={`sur ${appointmentStats.total} total`}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <KpiCard
          icon={CalendarX}
          label="Taux annulation"
          value={`${cancellationRate}%`}
          iconBg={Number(cancellationRate) > 20 ? 'bg-rose-100' : 'bg-slate-100'}
          iconColor={Number(cancellationRate) > 20 ? 'text-rose-600' : 'text-slate-500'}
        />
        <KpiCard
          icon={UserX}
          label="Taux no-show"
          value={`${noShowRate}%`}
          iconBg={Number(noShowRate) > 10 ? 'bg-rose-100' : 'bg-slate-100'}
          iconColor={Number(noShowRate) > 10 ? 'text-rose-600' : 'text-slate-500'}
        />
      </div>

      {/* Revenue chart */}
      {showChart && revenueStats.chartData.some((d) => d.ca > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">
            CA par jour
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueStats.chartData} barSize={10}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide />
                <Tooltip
                  formatter={(v) =>
                    [formatPrice(typeof v === 'number' ? v : Number(v)), 'CA'] as [string, string]
                  }
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="ca" radius={[3, 3, 0, 0]} animationDuration={600}>
                  {revenueStats.chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.ca > 0 ? '#8b5cf6' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 5 services */}
      {revenueStats.topServices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Top prestations
            </p>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-8">
                  #
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Prestation
                </th>
                <th className="px-5 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Nombre
                </th>
                <th className="px-5 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  CA
                </th>
              </tr>
            </thead>
            <tbody>
              {revenueStats.topServices.map((svc, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-3 text-sm text-slate-400">{i + 1}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 font-medium">{svc.name}</td>
                  <td className="px-5 py-3 text-sm text-slate-500 text-right">{svc.count}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900 text-right">
                    {formatPrice(svc.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {revenueStats.totalRevenue === 0 && appointmentStats.total === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <TrendingUp size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-700">Aucune donnée pour cette période</p>
          <p className="text-xs text-slate-400 mt-1">
            Sélectionnez une autre période pour voir les statistiques
          </p>
        </div>
      )}
    </div>
  );
};
