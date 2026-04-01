import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Award, Wallet, BarChart2, ShoppingBag, Scissors, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StaffAvatar } from '../../../components/StaffAvatar';
import { DateRangePicker } from '../../../components/DateRangePicker';
import { formatPrice } from '../../../lib/format';
import { useTransactions } from '../../../hooks/useTransactions';
import type { StaffMember, DateRange, Transaction, CartItem, BonusTier } from '../../../types';

interface Props {
  staff: StaffMember;
  baseSalary: number | null;
  onClose: () => void;
}

function calcBonus(revenue: number, tiers?: BonusTier[]) {
  if (!tiers || tiers.length === 0) return { bonus: 0, reachedTier: null, nextTier: null };
  const sorted = [...tiers].sort((a, b) => a.target - b.target);
  let reachedTier: BonusTier | null = null;
  let nextTier: BonusTier | null = null;
  for (const tier of sorted) {
    if (revenue >= tier.target) reachedTier = tier;
    else if (!nextTier) nextTier = tier;
  }
  return { bonus: reachedTier?.bonus ?? 0, reachedTier, nextTier };
}

function KpiBox({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="text-slate-400" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`text-lg font-bold ${accent ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export const StaffKpiModal: React.FC<Props> = ({ staff, baseSalary, onClose }) => {
  const { transactions } = useTransactions();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      label: 'Ce mois-ci',
    };
  });

  const filtered = useMemo(() => {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    return transactions.filter(t => {
      const time = new Date(t.date).getTime();
      return time >= from && time <= to;
    });
  }, [transactions, dateRange]);

  const stats = useMemo(() => {
    let serviceRevenue = 0, productRevenue = 0, txCount = 0;
    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    const dailyMap = new Map<string, number>();

    filtered.forEach((t: Transaction) => {
      const hasStaff = t.items.some((i: CartItem) => i.staffId === staff.id);
      if (!hasStaff) return;
      txCount++;

      const dayKey = new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

      t.items.forEach((item: CartItem) => {
        if (item.staffId !== staff.id) return;
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
    const avgBasket = txCount > 0 ? totalRevenue / txCount : 0;
    const topServices = [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const ratio = baseSalary && baseSalary > 0 ? totalRevenue / baseSalary : null;
    const { bonus, reachedTier, nextTier } = calcBonus(totalRevenue, staff.bonusTiers);

    // Build daily chart — iterate every day in range
    const chartData: { name: string; ca: number; sortKey: number }[] = [];
    const cur = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    while (cur <= end) {
      const key = cur.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      chartData.push({ name: key, ca: dailyMap.get(key) || 0, sortKey: cur.getTime() });
      cur.setDate(cur.getDate() + 1);
    }

    return {
      totalRevenue, serviceRevenue, productRevenue,
      txCount, avgBasket, topServices, ratio,
      bonus, reachedTier, nextTier,
      chartData,
    };
  }, [filtered, staff, baseSalary, dateRange]);

  const ratioColor =
    stats.ratio === null ? 'text-slate-400' :
    stats.ratio >= 2.5 ? 'text-emerald-600' :
    stats.ratio >= 1.5 ? 'text-blue-600' :
    stats.ratio >= 1   ? 'text-amber-600' :
                         'text-rose-600';

  // Show chart only if range <= 31 days
  const daysDiff = Math.ceil(
    (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
  );
  const showChart = daysDiff <= 31;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <StaffAvatar firstName={staff.firstName} lastName={staff.lastName} photoUrl={staff.photoUrl} size={40} />
            <div>
              <p className="font-semibold text-slate-900">{staff.firstName} {staff.lastName}</p>
              <p className="text-xs text-slate-500">{staff.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Date picker */}
          <div className="flex justify-end">
            <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiBox icon={TrendingUp} label="CA total" value={formatPrice(stats.totalRevenue)} />
            <KpiBox icon={BarChart2} label="Transactions" value={String(stats.txCount)} />
            <KpiBox icon={ShoppingBag} label="Panier moyen" value={stats.txCount > 0 ? formatPrice(stats.avgBasket) : '—'} />
            <KpiBox icon={Award} label="Bonus attribué" value={stats.bonus > 0 ? formatPrice(stats.bonus) : '—'} accent={stats.bonus > 0} />
          </div>

          {/* Services vs Produits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Scissors size={13} className="text-pink-500" />
                <span className="text-xs text-pink-600 font-medium">Prestations</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{formatPrice(stats.serviceRevenue)}</p>
              {stats.totalRevenue > 0 && (
                <p className="text-xs text-pink-500 mt-0.5">
                  {((stats.serviceRevenue / stats.totalRevenue) * 100).toFixed(0)}% du CA
                </p>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShoppingBag size={13} className="text-blue-500" />
                <span className="text-xs text-blue-600 font-medium">Produits</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{formatPrice(stats.productRevenue)}</p>
              {stats.totalRevenue > 0 && (
                <p className="text-xs text-blue-500 mt-0.5">
                  {((stats.productRevenue / stats.totalRevenue) * 100).toFixed(0)}% du CA
                </p>
              )}
            </div>
          </div>

          {/* Daily chart */}
          {showChart && stats.chartData.some(d => d.ca > 0) && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">CA par jour</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} barSize={10}>
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
                      {stats.chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.ca > 0 ? '#ec4899' : '#f1f5f9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Bonus tiers */}
          {staff.bonusTiers && staff.bonusTiers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Paliers de bonus</p>
              <div className="space-y-2">
                {[...staff.bonusTiers].sort((a, b) => a.target - b.target).map((tier, i) => {
                  const reached = stats.totalRevenue >= tier.target;
                  const progress = Math.min((stats.totalRevenue / tier.target) * 100, 100);
                  return (
                    <div key={i} className={`rounded-lg border p-3 ${reached ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Target size={13} className={reached ? 'text-amber-600' : 'text-slate-400'} />
                          <span className="text-xs font-medium text-slate-700">
                            Objectif {formatPrice(tier.target)}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold ${reached ? 'text-amber-700' : 'text-slate-500'}`}>
                          {reached ? '✓ ' : ''}{formatPrice(tier.bonus)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${reached ? 'bg-amber-500' : 'bg-slate-300'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {!reached && (
                        <p className="text-xs text-slate-400 mt-1">
                          Manque {formatPrice(tier.target - stats.totalRevenue)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ratio CA / Salaire */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={14} className="text-slate-500" />
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ratio CA / Salaire</p>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">
                Salaire base : {baseSalary != null ? formatPrice(baseSalary) : <span className="italic text-slate-400">non défini</span>}
              </span>
              <span className={`text-lg font-bold ${ratioColor}`}>
                {stats.ratio != null ? `${stats.ratio.toFixed(2)}x` : '—'}
              </span>
            </div>
            {stats.ratio != null && (
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.ratio >= 2.5 ? 'bg-emerald-500' :
                    stats.ratio >= 1.5 ? 'bg-blue-500' :
                    stats.ratio >= 1   ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(stats.ratio * 33, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Top services */}
          {stats.topServices.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Top prestations</p>
              <div className="space-y-2">
                {stats.topServices.map((svc, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                      <span className="text-sm text-slate-700">{svc.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-slate-900">{formatPrice(svc.revenue)}</span>
                      <span className="text-xs text-slate-400 ml-2">×{svc.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
