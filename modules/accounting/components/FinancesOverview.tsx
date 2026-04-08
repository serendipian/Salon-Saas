import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { formatPrice } from '../../../lib/format';
import { MiniKpiRow } from './MiniKpiRow';
import type { FinancesOutletContext } from '../FinancesLayout';

const CATEGORY_COLORS = ['#0f172a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444'];

// Payment method horizontal bars
const PaymentMethodBar: React.FC<{ data: { method: string; amount: number; percent: number }[] }> = ({ data }) => (
  <div className="space-y-3">
    {data.map((item, idx) => (
      <div key={item.method}>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-slate-700">{item.method}</span>
          <span className="text-slate-500">{formatPrice(item.amount)} ({item.percent.toFixed(0)}%)</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.percent}%`, backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
        </div>
      </div>
    ))}
    {data.length === 0 && <div className="text-sm text-slate-400 text-center py-4">Aucune donn&#233;e</div>}
  </div>
);

// Ranked list (for top services/products)
const RankedList: React.FC<{ title: string; items: { name: string; count: number; revenue: number }[] }> = ({ title, items }) => {
  const maxRevenue = items.length > 0 ? items[0].revenue : 1;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.name} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-700 truncate pr-2">{i + 1}. {item.name}</span>
              <span className="font-medium text-slate-900 whitespace-nowrap">{formatPrice(item.revenue)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: `${(item.revenue / maxRevenue) * 100}%` }} />
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-slate-400">Aucune donn&#233;e</li>}
      </ul>
    </div>
  );
};

export const FinancesOverview: React.FC = () => {
  const {
    financials, chartData, revenueByServiceCategory, paymentMethodBreakdown,
    clientMetrics, topProducts, productRevenue, filteredTransactions,
  } = useOutletContext<FinancesOutletContext>();

  // Void/refund summary
  const voidCount = filteredTransactions.filter(t => t.type === 'VOID').length;
  const refundCount = filteredTransactions.filter(t => t.type === 'REFUND').length;
  const totalLost = filteredTransactions
    .filter(t => t.type === 'VOID' || t.type === 'REFUND')
    .reduce((sum, t) => sum + Math.abs(t.total), 0);

  // Donut data: service categories + products as one slice
  const donutData = [
    ...revenueByServiceCategory.map((cat, idx) => ({
      name: cat.categoryName,
      value: cat.revenue,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    })),
    ...(productRevenue.total > 0 ? [{ name: 'Produits', value: productRevenue.total, color: '#f59e0b' }] : []),
  ];

  // Top 5 services (flatten from all categories)
  const topServicesList: { name: string; count: number; revenue: number }[] = [];
  revenueByServiceCategory.forEach(cat => {
    cat.services.forEach(svc => topServicesList.push(svc));
  });
  topServicesList.sort((a, b) => b.revenue - a.revenue);
  const top5Services = topServicesList.slice(0, 5);

  const margin = financials.revenue > 0 ? ((financials.netProfit / financials.revenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* 4 KPIs */}
      <MiniKpiRow columns={4} items={[
        { title: "Chiffre d'Affaires", value: financials.revenue, trend: financials.revenueTrend },
        { title: 'Bénéfice Net', value: financials.netProfit, trend: financials.netProfitTrend, subtitle: `marge ${margin}%` },
        { title: 'Dépenses Totales', value: financials.opex, trend: financials.opexTrend, invertTrend: true },
        { title: 'Panier Moyen', value: financials.avgBasket, trend: financials.avgBasketTrend, subtitle: `${financials.transactionCount} transactions` },
      ]} />

      {/* Void/Refund summary (only shown when there are any) */}
      {(voidCount > 0 || refundCount > 0) && (
        <div className="flex items-center gap-4 px-1">
          {voidCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-500">{voidCount} annulation{voidCount > 1 ? 's' : ''}</span>
            </div>
          )}
          {refundCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-slate-500">{refundCount} remboursement{refundCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="text-sm font-medium text-red-600">
            -{formatPrice(totalLost)}
          </div>
          <a href="/finances/annulations" className="text-xs text-blue-600 hover:text-blue-800 ml-auto">
            Voir le détail →
          </a>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">&#201;volution du CA</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} cursor={{ fill: '#f8fafc' }} formatter={(value: number) => formatPrice(value)} />
                <Bar dataKey="sales" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">R&#233;partition par Cat&#233;gorie</h3>
          <div className="h-64 flex items-center">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {donutData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatPrice(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full text-center text-sm text-slate-400">Aucune donn&#233;e</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Flux de Tr&#233;sorerie</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} formatter={(value: number) => formatPrice(value)} />
                <Line type="monotone" dataKey="sales" stroke="#0f172a" strokeWidth={2} dot={false} name="Revenus" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="D&#233;penses" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Moyens de Paiement</h3>
          <PaymentMethodBar data={paymentMethodBreakdown} />
        </div>
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RankedList title="Top 5 Services" items={top5Services} />
        <RankedList title="Top 5 Produits" items={topProducts} />

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Clients Servis</h3>
          <div className="text-3xl font-bold text-slate-900 mb-1">{clientMetrics.uniqueClients}</div>
          <div className="text-xs text-slate-500">
            {clientMetrics.newClients > 0 ? <span className="text-emerald-600 font-medium">{clientMetrics.newClients} nouveaux</span> : 'cette p&#233;riode'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">TVA Estim&#233;e</h3>
          <div className="text-3xl font-bold text-slate-900 mb-1">{formatPrice(financials.vatDue)}</div>
          <div className="text-xs text-slate-500">&#192; provisionner</div>
        </div>
      </div>
    </div>
  );
};
