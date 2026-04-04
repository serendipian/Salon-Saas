// modules/team/components/StaffPerformanceTab.tsx
import React, { useState, useMemo } from 'react';
import { TrendingUp, ShoppingBag, Scissors, BarChart2, CalendarCheck, CalendarX, UserX } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DateRangePicker } from '../../../components/DateRangePicker';
import { formatPrice } from '../../../lib/format';
import { useTransactions } from '../../../hooks/useTransactions';
import { useAppointments } from '../../appointments/hooks/useAppointments';
import type { DateRange, Transaction, CartItem } from '../../../types';

interface StaffPerformanceTabProps {
  staffId: string;
  currencySymbol: string;
}

function KpiCard({ icon: Icon, label, value, sub, color = 'text-slate-900' }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={14} className="text-slate-400" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export const StaffPerformanceTab: React.FC<StaffPerformanceTabProps> = ({ staffId }) => {
  const { transactions } = useTransactions();
  const { allAppointments: appointments } = useAppointments();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      label: 'Ce mois-ci',
    };
  });

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    return transactions.filter(t => {
      const time = new Date(t.date).getTime();
      return time >= from && time <= to;
    });
  }, [transactions, dateRange]);

  // Revenue stats from transaction items attributed to this staff member
  const revenueStats = useMemo(() => {
    let serviceRevenue = 0;
    let productRevenue = 0;
    const txIds = new Set<string>();
    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    const dailyMap = new Map<string, number>();

    filteredTransactions.forEach((t: Transaction) => {
      const staffItems = (t.items || []).filter((i: CartItem) => i.staffId === staffId);
      if (staffItems.length === 0) return;
      txIds.add(t.id);

      const dayKey = new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

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

    // Build daily chart data - iterate every day in range
    const chartData: { name: string; ca: number }[] = [];
    const cur = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    while (cur <= end) {
      const key = cur.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      chartData.push({ name: key, ca: dailyMap.get(key) || 0 });
      cur.setDate(cur.getDate() + 1);
    }

    return { totalRevenue, serviceRevenue, productRevenue, avgBasket, txCount: txIds.size, topServices, chartData };
  }, [filteredTransactions, staffId, dateRange]);

  // Appointment stats
  const appointmentStats = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const staffAppts = appointments.filter(a => {
      if (a.staffId !== staffId) return false;
      const time = new Date(a.date).getTime();
      return time >= from && time <= to;
    });
    const completed = staffAppts.filter(a => a.status === 'COMPLETED').length;
    const cancelled = staffAppts.filter(a => a.status === 'CANCELLED').length;
    const noShow = staffAppts.filter(a => a.status === 'NO_SHOW').length;
    const total = staffAppts.length;
    return { completed, cancelled, noShow, total };
  }, [appointments, staffId, dateRange]);

  const cancellationRate = appointmentStats.total > 0
    ? ((appointmentStats.cancelled / appointmentStats.total) * 100).toFixed(1)
    : '0';
  const noShowRate = appointmentStats.total > 0
    ? ((appointmentStats.noShow / appointmentStats.total) * 100).toFixed(1)
    : '0';

  // Show chart only if range <= 31 days
  const daysDiff = Math.ceil(
    (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
  );
  const showChart = daysDiff <= 31;

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <div className="flex justify-end">
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="CA total" value={formatPrice(revenueStats.totalRevenue)} />
        <KpiCard icon={Scissors} label="CA prestations" value={formatPrice(revenueStats.serviceRevenue)} />
        <KpiCard icon={ShoppingBag} label="CA produits" value={formatPrice(revenueStats.productRevenue)} />
        <KpiCard icon={BarChart2} label="Panier moyen" value={revenueStats.txCount > 0 ? formatPrice(revenueStats.avgBasket) : '\u2014'} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard
          icon={CalendarCheck}
          label="RDV effectues"
          value={String(appointmentStats.completed)}
          sub={`sur ${appointmentStats.total} total`}
        />
        <KpiCard
          icon={CalendarX}
          label="Taux annulation"
          value={`${cancellationRate}%`}
          color={Number(cancellationRate) > 20 ? 'text-rose-600' : 'text-slate-900'}
        />
        <KpiCard
          icon={UserX}
          label="Taux no-show"
          value={`${noShowRate}%`}
          color={Number(noShowRate) > 10 ? 'text-rose-600' : 'text-slate-900'}
        />
      </div>

      {/* Revenue chart */}
      {showChart && revenueStats.chartData.some(d => d.ca > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">CA par jour</p>
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
                  formatter={(v: number) => [formatPrice(v), 'CA']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="ca" radius={[3, 3, 0, 0]} animationDuration={600}>
                  {revenueStats.chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.ca > 0 ? '#ec4899' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 5 services */}
      {revenueStats.topServices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">Top prestations</p>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium w-8">#</th>
                <th className="pb-2 font-medium">Prestation</th>
                <th className="pb-2 font-medium text-right">Nombre</th>
                <th className="pb-2 font-medium text-right">CA</th>
              </tr>
            </thead>
            <tbody>
              {revenueStats.topServices.map((svc, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 text-sm text-slate-400">{i + 1}</td>
                  <td className="py-2.5 text-sm text-slate-700">{svc.name}</td>
                  <td className="py-2.5 text-sm text-slate-500 text-right">{svc.count}</td>
                  <td className="py-2.5 text-sm font-medium text-slate-900 text-right">{formatPrice(svc.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {revenueStats.totalRevenue === 0 && appointmentStats.total === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <TrendingUp size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Aucune donnee pour cette periode</p>
        </div>
      )}
    </div>
  );
};
