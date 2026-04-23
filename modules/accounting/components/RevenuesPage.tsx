import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatPrice } from '../../../lib/format';
import { useSettings } from '../../settings/hooks/useSettings';
import type { FinancesOutletContext } from '../FinancesLayout';
import { calcTrend } from '../hooks/useAccounting';
import {
  useRevenueByDayOfMonth,
  useRevenueByDayOfWeek,
  useRevenueByHour,
  useRevenueByMonth,
} from '../hooks/useRevenueActivityCharts';
import { useRevenueBreakdown } from '../hooks/useRevenueBreakdown';
import { KpiCard, MiniKpiRow } from './MiniKpiRow';
import { PaymentBreakdownCard } from './PaymentBreakdownCard';
import { ALL_REVENUE_METHODS } from './paymentMethodConstants';
import { RevenueActivityChart } from './RevenueActivityChart';
import { RevenueCategoryTable } from './RevenueCategoryTable';

type ServiceSubTab = 'PAR_CATEGORIE' | 'PAR_EQUIPE';
type ProductSubTab = 'PAR_CATEGORIE' | 'TOUS' | 'PAR_EQUIPE';

export const RevenuesPage: React.FC = () => {
  const {
    filteredTransactions,
    prevFilteredTransactions,
    dateRange,
    financials,
    revenueTab: mainTab,
  } = useOutletContext<FinancesOutletContext>();
  const {
    serviceRevenue,
    productRevenue,
    prevServiceRevenue,
    prevProductRevenue,
    revenueByServiceCategory,
    revenueByProductCategory,
    revenueByStaffServices,
    revenueByStaffProducts,
  } = useRevenueBreakdown(filteredTransactions, prevFilteredTransactions);

  const { salonSettings } = useSettings();
  const byHour = useRevenueByHour(filteredTransactions, salonSettings?.schedule, dateRange);
  const byDow = useRevenueByDayOfWeek(dateRange, filteredTransactions);
  const byDom = useRevenueByDayOfMonth(dateRange, filteredTransactions);
  const byMonth = useRevenueByMonth(dateRange);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    ALL_REVENUE_METHODS.forEach((m) => map.set(m, 0));
    filteredTransactions.forEach((t) => {
      (t.payments || []).forEach((p) => {
        map.set(p.method, (map.get(p.method) || 0) + p.amount);
      });
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([method, amount]) => ({
        method,
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  const [serviceSubTab, setServiceSubTab] = useState<ServiceSubTab>('PAR_CATEGORIE');
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>('PAR_CATEGORIE');

  const serviceCategoryData = revenueByServiceCategory.map((cat) => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    count: cat.count,
    revenue: cat.revenue,
    items: cat.services,
  }));

  const productCategoryData = revenueByProductCategory.map((cat) => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    count: cat.count,
    revenue: cat.revenue,
    items: cat.products.map((p) => ({ name: p.name, count: p.count, revenue: p.revenue })),
  }));

  // Flat product list for "Tous les produits"
  const allProducts = revenueByProductCategory
    .flatMap((cat) => cat.products.map((p) => ({ ...p, categoryName: cat.categoryName })))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* SERVICES TAB */}
        {mainTab === 'SERVICES' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <PaymentBreakdownCard
                  title="CA Services"
                  total={serviceRevenue.total}
                  trend={calcTrend(serviceRevenue.total, prevServiceRevenue.total)}
                  methods={paymentBreakdown}
                />
              </div>
              <div className="flex flex-col gap-4">
                <KpiCard
                  title="Transactions"
                  value={financials.transactionCount}
                  format="number"
                  trend={calcTrend(
                    financials.transactionCount,
                    prevFilteredTransactions.filter((t) => t.type === 'SALE').length,
                  )}
                />
                <KpiCard
                  title="Prestations"
                  value={serviceRevenue.count}
                  format="number"
                  trend={calcTrend(serviceRevenue.count, prevServiceRevenue.count)}
                />
              </div>
              <div className="flex flex-col gap-4">
                <KpiCard
                  title="Panier Moyen"
                  value={financials.avgBasket}
                  trend={financials.avgBasketTrend}
                />
                <KpiCard
                  title="Prix Moyen"
                  value={serviceRevenue.avgPrice}
                  trend={calcTrend(serviceRevenue.avgPrice, prevServiceRevenue.avgPrice)}
                />
              </div>
            </div>

            <div className="inline-flex gap-1 bg-slate-100/80 p-1 rounded-xl ring-1 ring-slate-200/60 w-fit">
              {[
                { id: 'PAR_CATEGORIE' as ServiceSubTab, label: 'Par catégorie' },
                { id: 'PAR_EQUIPE' as ServiceSubTab, label: 'Par équipe' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setServiceSubTab(tab.id)}
                  className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    serviceSubTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {serviceSubTab === 'PAR_CATEGORIE' && (
              <RevenueCategoryTable
                data={serviceCategoryData}
                totalRevenue={serviceRevenue.total}
                itemLabel="prestations"
              />
            )}
            {serviceSubTab === 'PAR_EQUIPE' && (
              <StaffServiceTable
                data={revenueByStaffServices}
                totalRevenue={serviceRevenue.total}
                totalCount={serviceRevenue.count}
              />
            )}
          </>
        )}

        {/* PRODUCTS TAB */}
        {mainTab === 'PRODUCTS' && (
          <>
            <MiniKpiRow
              items={[
                {
                  title: 'CA Produits',
                  value: productRevenue.total,
                  trend: calcTrend(productRevenue.total, prevProductRevenue.total),
                },
                {
                  title: 'Articles Vendus',
                  value: productRevenue.count,
                  format: 'number',
                  trend: calcTrend(productRevenue.count, prevProductRevenue.count),
                },
                {
                  title: 'Prix Moyen',
                  value: productRevenue.avgPrice,
                  trend: calcTrend(productRevenue.avgPrice, prevProductRevenue.avgPrice),
                },
              ]}
            />

            <div className="inline-flex gap-1 bg-slate-100/80 p-1 rounded-xl ring-1 ring-slate-200/60 w-fit">
              {[
                { id: 'PAR_CATEGORIE' as ProductSubTab, label: 'Par catégorie' },
                { id: 'TOUS' as ProductSubTab, label: 'Tous les produits' },
                { id: 'PAR_EQUIPE' as ProductSubTab, label: 'Par équipe' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setProductSubTab(tab.id)}
                  className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    productSubTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {productSubTab === 'PAR_CATEGORIE' && (
              <RevenueCategoryTable
                data={productCategoryData}
                totalRevenue={productRevenue.total}
                itemLabel="articles"
              />
            )}

            {productSubTab === 'TOUS' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-xs font-semibold text-slate-500 uppercase">
                      <th className="px-4 py-3">Produit</th>
                      <th className="px-4 py-3">Catégorie</th>
                      <th className="px-4 py-3 text-right">Qté vendue</th>
                      <th className="px-4 py-3 text-right">CA</th>
                      <th className="px-4 py-3 text-right">% du total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors text-sm">
                        <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                        <td className="px-4 py-3 text-slate-500">{p.categoryName}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{p.count}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatPrice(p.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {productRevenue.total > 0
                            ? ((p.revenue / productRevenue.total) * 100).toFixed(1)
                            : '0.0'}
                          %
                        </td>
                      </tr>
                    ))}
                    {allProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                          Aucune donnée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {productSubTab === 'PAR_EQUIPE' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-xs font-semibold text-slate-500 uppercase">
                      <th className="px-4 py-3">Membre</th>
                      <th className="px-4 py-3 text-right">Qté vendue</th>
                      <th className="px-4 py-3 text-right">CA</th>
                      <th className="px-4 py-3 text-right">% du total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenueByStaffProducts.map((row, idx) => (
                      <tr
                        key={row.staffId || idx}
                        className="hover:bg-slate-50 transition-colors text-sm"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                              <Users size={12} className="text-slate-400" />
                            </div>
                            <span
                              className={`font-medium ${row.staffId ? 'text-slate-900' : 'text-slate-400 italic'}`}
                            >
                              {row.staffName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatPrice(row.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {row.percent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    {revenueByStaffProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                          Aucune donnée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: Activity charts sidebar */}
      <div className="w-full lg:w-2/5 shrink-0 space-y-4">
        <RevenueActivityChart
          title="CA (Heure)"
          data={byHour.data}
          periodLabel={byHour.periodLabel}
          highlightIndex={byHour.highlightIndex}
        />
        <RevenueActivityChart
          title="CA (Jours/Semaine)"
          data={byDow.data}
          periodLabel={byDow.periodLabel}
          highlightIndex={byDow.highlightIndex}
        />
        <RevenueActivityChart
          title="CA (Jours/Mois)"
          data={byDom.data}
          periodLabel={byDom.periodLabel}
          highlightIndex={byDom.highlightIndex}
        />
        <RevenueActivityChart
          title="CA (Mois)"
          data={byMonth.data}
          periodLabel={byMonth.periodLabel}
          onPrev={byMonth.goToPrevYear}
          onNext={byMonth.goToNextYear}
          highlightIndex={byMonth.highlightIndex}
        />
      </div>
    </div>
  );
};

// --- Staff Service Table with expandable detail rows ---

interface StaffServiceRow {
  staffId: string | null;
  staffName: string;
  count: number;
  revenue: number;
  avgBasket: number;
  percent: number;
  commission: number;
  bonus: number;
  services: { name: string; variantName?: string; count: number; revenue: number }[];
}

type StaffSortKey = 'staffName' | 'count' | 'revenue' | 'avgBasket';
type StaffSortDir = 'asc' | 'desc';

const StaffServiceTable: React.FC<{
  data: StaffServiceRow[];
  totalRevenue: number;
  totalCount: number;
}> = ({ data, totalRevenue, totalCount }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<StaffSortKey>('revenue');
  const [sortDir, setSortDir] = useState<StaffSortDir>('desc');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (key: StaffSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'staffName' ? 'asc' : 'desc');
    }
  };

  const sortedData = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'staffName') return a.staffName.localeCompare(b.staffName) * dir;
      if (sortKey === 'count') return (a.count - b.count) * dir;
      if (sortKey === 'revenue') return (a.revenue - b.revenue) * dir;
      return (a.avgBasket - b.avgBasket) * dir;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const maxRevenue = useMemo(
    () => sortedData.reduce((m, r) => Math.max(m, r.revenue), 0),
    [sortedData],
  );

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-400">
        Aucune donnée pour cette période
      </div>
    );
  }

  const SortHeader: React.FC<{
    label: string;
    sortableKey: StaffSortKey;
    align?: 'left' | 'right';
  }> = ({ label, sortableKey, align = 'right' }) => {
    const active = sortKey === sortableKey;
    return (
      <th className={`px-5 py-4 ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <button
          type="button"
          onClick={() => handleSort(sortableKey)}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            align === 'right' ? 'flex-row-reverse' : ''
          } ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <span>{label}</span>
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp size={14} className="text-blue-500" />
            ) : (
              <ChevronDown size={14} className="text-blue-500" />
            )
          ) : (
            <ChevronsUpDown size={12} className="text-slate-300" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-left tabular-nums">
        <thead className="bg-slate-50/80 border-b border-slate-200">
          <tr>
            <th className="px-4 py-4 w-12"></th>
            <SortHeader label="Membre" sortableKey="staffName" align="left" />
            <SortHeader label="Prestations" sortableKey="count" />
            <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              % prestations
            </th>
            <SortHeader label="CA" sortableKey="revenue" />
            <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              % du CA
            </th>
            <SortHeader label="Panier Moyen" sortableKey="avgBasket" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedData.map((row, idx) => {
            const key = row.staffId || `unassigned-${idx}`;
            const isExpanded = expandedIds.has(key);
            const barWidth = maxRevenue > 0 ? (row.revenue / maxRevenue) * 100 : 0;
            const rank = idx + 1;

            return (
              <React.Fragment key={key}>
                <tr
                  className="hover:bg-blue-50/40 transition-all cursor-pointer text-sm group"
                  onClick={() => toggleExpand(key)}
                >
                  <td className="pl-4 pr-2 py-4 w-12">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold ${
                          rank <= 3 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                        }`}
                      >
                        {rank}
                      </span>
                      <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center ring-1 ring-slate-200/60">
                        <Users size={14} className="text-slate-500" />
                      </div>
                      <span
                        className={`font-semibold ${
                          row.staffId ? 'text-slate-900' : 'text-slate-400 italic'
                        }`}
                      >
                        {row.staffName}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">{row.count}</td>
                  <td className="px-5 py-4 text-right text-slate-500">
                    {totalCount > 0 ? ((row.count / totalCount) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-900 whitespace-nowrap">
                        {formatPrice(row.revenue)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-500">{row.percent.toFixed(1)}%</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">
                    {formatPrice(row.avgBasket)}
                  </td>
                </tr>
                {isExpanded &&
                  row.services.map((svc, sIdx) => (
                    <tr key={`${key}-${sIdx}`} className="bg-slate-50/60 text-sm">
                      <td className="px-4 py-3"></td>
                      <td className="px-5 py-3 text-slate-600 pl-12">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          {svc.name}
                          {svc.variantName && (
                            <span className="text-slate-400 text-xs">({svc.variantName})</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-600">
                        {svc.count}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400">
                        {totalCount > 0 ? ((svc.count / totalCount) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-600">
                        {formatPrice(svc.revenue)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400">
                        {totalRevenue > 0 ? ((svc.revenue / totalRevenue) * 100).toFixed(1) : '0.0'}
                        %
                      </td>
                      <td className="px-5 py-3"></td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
