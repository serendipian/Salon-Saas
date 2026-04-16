import { Info } from 'lucide-react';
import type React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '../../../components/SafeResponsiveContainer';
import { formatPrice } from '../../../lib/format';
import type { FinancesOutletContext } from '../FinancesLayout';
import { useRevenueBreakdown } from '../hooks/useRevenueBreakdown';
import { MiniKpiRow } from './MiniKpiRow';

const CATEGORY_COLORS = [
  '#0f172a',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#6366f1',
  '#ef4444',
];

// Payment method horizontal bars
const PaymentMethodBar: React.FC<{
  data: { method: string; amount: number; percent: number }[];
}> = ({ data }) => (
  <div className="space-y-3">
    {data.map((item, idx) => (
      <div key={item.method}>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-slate-700">{item.method}</span>
          <span className="text-slate-500">
            {formatPrice(item.amount)} ({item.percent.toFixed(0)}%)
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${item.percent}%`,
              backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
            }}
          />
        </div>
      </div>
    ))}
    {data.length === 0 && (
      <div className="text-sm text-slate-400 text-center py-4">Aucune donn&#233;e</div>
    )}
  </div>
);

// Ranked list (for top services/products)
const RankedList: React.FC<{
  title: string;
  items: { name: string; count: number; revenue: number }[];
}> = ({ title, items }) => {
  const maxRevenue = items.length > 0 ? items[0].revenue : 1;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.name} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-700 truncate pr-2">
                {i + 1}. {item.name}
              </span>
              <span className="font-medium text-slate-900 whitespace-nowrap">
                {formatPrice(item.revenue)}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full"
                style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
              />
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
    financials,
    chartData,
    chartHighlight,
    clientMetrics,
    filteredTransactions,
    prevFilteredTransactions,
  } = useOutletContext<FinancesOutletContext>();
  const { revenueByServiceCategory, paymentMethodBreakdown, topProducts, productRevenue } =
    useRevenueBreakdown(filteredTransactions, prevFilteredTransactions);

  // Void/refund summary
  const voidCount = filteredTransactions.filter((t) => t.type === 'VOID').length;
  const refundCount = filteredTransactions.filter((t) => t.type === 'REFUND').length;
  const totalLost = filteredTransactions
    .filter((t) => t.type === 'VOID' || t.type === 'REFUND')
    .reduce((sum, t) => sum + Math.abs(t.total), 0);

  // Donut data: service categories + products as one slice
  const donutData = [
    ...revenueByServiceCategory.map((cat, idx) => ({
      name: cat.categoryName,
      value: cat.revenue,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    })),
    ...(productRevenue.total > 0
      ? [{ name: 'Produits', value: productRevenue.total, color: '#f59e0b' }]
      : []),
  ];

  // Top 5 services (flatten from all categories)
  const topServicesList: { name: string; count: number; revenue: number }[] = [];
  revenueByServiceCategory.forEach((cat) => {
    cat.services.forEach((svc) => topServicesList.push(svc));
  });
  topServicesList.sort((a, b) => b.revenue - a.revenue);
  const top5Services = topServicesList.slice(0, 5);

  const margin =
    financials.revenue > 0 ? ((financials.netProfit / financials.revenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* 4 KPIs */}
      <MiniKpiRow
        columns={4}
        items={[
          {
            title: "Chiffre d'Affaires",
            value: financials.revenue,
            trend: financials.revenueTrend,
          },
          {
            title: 'Bénéfice Net',
            value: financials.netProfit,
            trend: financials.netProfitTrend,
            subtitle: `marge ${margin}%`,
          },
          {
            title: 'Dépenses Totales',
            value: financials.opex,
            trend: financials.opexTrend,
            invertTrend: true,
          },
          {
            title: 'Panier Moyen',
            value: financials.avgBasket,
            trend: financials.avgBasketTrend,
            subtitle: `${financials.transactionCount} transactions`,
          },
        ]}
      />

      {/* Void/Refund summary (only shown when there are any) */}
      {(voidCount > 0 || refundCount > 0) && (
        <div className="flex items-center gap-4 px-1">
          {voidCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-500">
                {voidCount} annulation{voidCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {refundCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-slate-500">
                {refundCount} remboursement{refundCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="text-sm font-medium text-red-600">-{formatPrice(totalLost)}</div>
          <Link
            to="/finances/annulations"
            className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
          >
            Voir le détail →
          </Link>
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
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value) =>
                    formatPrice(typeof value === 'number' ? value : Number(value))
                  }
                />
                <Bar dataKey="sales" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30}>
                  {chartData.map((_entry, i) => (
                    <Cell key={i} fill={chartHighlight.has(i) ? '#0f172a' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            R&#233;partition par Cat&#233;gorie
          </h3>
          <div className="h-64 flex items-center">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {donutData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatPrice(typeof value === 'number' ? value : Number(value))
                    }
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  />
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
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  formatter={(value) =>
                    formatPrice(typeof value === 'number' ? value : Number(value))
                  }
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#0f172a"
                  strokeWidth={2}
                  name="Revenus"
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    if (
                      !chartHighlight.has(props.index ?? -1) ||
                      props.cx == null ||
                      props.cy == null
                    )
                      return <circle key={props.index} r={0} />;
                    return (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="#0f172a"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="D&#233;penses"
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    if (
                      !chartHighlight.has(props.index ?? -1) ||
                      props.cx == null ||
                      props.cy == null
                    )
                      return <circle key={props.index} r={0} />;
                    return (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="#ef4444"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
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
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {clientMetrics.uniqueClients}
          </div>
          <div className="text-xs text-slate-500">
            {clientMetrics.newClients > 0 ? (
              <span className="text-emerald-600 font-medium">
                {clientMetrics.newClients} nouveaux
              </span>
            ) : (
              'cette p&#233;riode'
            )}
          </div>
        </div>

        {/* M-11: TVA tile with prominent estimation caveat. The single-rate
            calculation is acceptable for owner-monitoring purposes (Moroccan
            and French salons typically operate at a uniform 20% rate), but
            the audit flagged that the previous "À provisionner" subtitle
            implied filing-grade accuracy. The new caveat + tooltip make the
            limitation visible without forcing users into a per-category
            VAT model. */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">TVA Provisionn&#233;e</h3>
            <span
              className="inline-flex"
              title="Estimation calcul&#233;e &#224; partir du taux unique configur&#233; dans les Param&#232;tres comptables. Pour votre d&#233;claration officielle, consultez votre comptable."
              aria-label="Informations sur le calcul de la TVA"
            >
              <Info size={11} className="text-slate-400 hover:text-slate-600 cursor-help" />
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {formatPrice(financials.vatDue)}
          </div>
          <div className="text-[11px] text-slate-400 leading-snug">
            Estimation au taux unique &mdash; v&#233;rifiez aupr&#232;s de votre comptable
          </div>
        </div>
      </div>
    </div>
  );
};
