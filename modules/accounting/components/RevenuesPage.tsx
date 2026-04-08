import React, { useState } from 'react';
import { Users, ChevronRight, ChevronDown } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { MiniKpiRow } from './MiniKpiRow';
import { RevenueCategoryTable } from './RevenueCategoryTable';
import { formatPrice } from '../../../lib/format';
import type { FinancesOutletContext } from '../FinancesLayout';

type MainTab = 'SERVICES' | 'PRODUCTS';
type ServiceSubTab = 'PAR_CATEGORIE' | 'PAR_EQUIPE';
type ProductSubTab = 'PAR_CATEGORIE' | 'TOUS' | 'PAR_EQUIPE';

export const RevenuesPage: React.FC = () => {
  const {
    serviceRevenue, productRevenue,
    prevServiceRevenue, prevProductRevenue,
    revenueByServiceCategory, revenueByProductCategory,
    revenueByStaffServices, revenueByStaffProducts,
    calcTrend,
  } = useOutletContext<FinancesOutletContext>();

  const [mainTab, setMainTab] = useState<MainTab>('SERVICES');
  const [serviceSubTab, setServiceSubTab] = useState<ServiceSubTab>('PAR_CATEGORIE');
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>('PAR_CATEGORIE');

  const serviceCategoryData = revenueByServiceCategory.map(cat => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    count: cat.count,
    revenue: cat.revenue,
    items: cat.services,
  }));

  const productCategoryData = revenueByProductCategory.map(cat => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    count: cat.count,
    revenue: cat.revenue,
    items: cat.products.map(p => ({ name: p.name, count: p.count, revenue: p.revenue })),
  }));

  // Flat product list for "Tous les produits"
  const allProducts = revenueByProductCategory.flatMap(cat =>
    cat.products.map(p => ({ ...p, categoryName: cat.categoryName }))
  ).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      {/* Main Tabs: Services | Produits */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'SERVICES' as MainTab, label: 'Services' },
          { id: 'PRODUCTS' as MainTab, label: 'Produits' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mainTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SERVICES TAB */}
      {mainTab === 'SERVICES' && (
        <>
          <MiniKpiRow items={[
            { title: 'CA Services', value: serviceRevenue.total, trend: calcTrend(serviceRevenue.total, prevServiceRevenue.total) },
            { title: 'Prestations', value: serviceRevenue.count, format: 'number', trend: calcTrend(serviceRevenue.count, prevServiceRevenue.count) },
            { title: 'Prix Moyen', value: serviceRevenue.avgPrice, trend: calcTrend(serviceRevenue.avgPrice, prevServiceRevenue.avgPrice) },
          ]} />

          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {[
              { id: 'PAR_CATEGORIE' as ServiceSubTab, label: 'Par catégorie' },
              { id: 'PAR_EQUIPE' as ServiceSubTab, label: 'Par équipe' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setServiceSubTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  serviceSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {serviceSubTab === 'PAR_CATEGORIE' && (
            <RevenueCategoryTable data={serviceCategoryData} totalRevenue={serviceRevenue.total} itemLabel="prestations" />
          )}
          {serviceSubTab === 'PAR_EQUIPE' && (
            <StaffServiceTable data={revenueByStaffServices} totalRevenue={serviceRevenue.total} />
          )}
        </>
      )}

      {/* PRODUCTS TAB */}
      {mainTab === 'PRODUCTS' && (
        <>
          <MiniKpiRow items={[
            { title: 'CA Produits', value: productRevenue.total, trend: calcTrend(productRevenue.total, prevProductRevenue.total) },
            { title: 'Articles Vendus', value: productRevenue.count, format: 'number', trend: calcTrend(productRevenue.count, prevProductRevenue.count) },
            { title: 'Prix Moyen', value: productRevenue.avgPrice, trend: calcTrend(productRevenue.avgPrice, prevProductRevenue.avgPrice) },
          ]} />

          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {[
              { id: 'PAR_CATEGORIE' as ProductSubTab, label: 'Par catégorie' },
              { id: 'TOUS' as ProductSubTab, label: 'Tous les produits' },
              { id: 'PAR_EQUIPE' as ProductSubTab, label: 'Par équipe' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setProductSubTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  productSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {productSubTab === 'PAR_CATEGORIE' && (
            <RevenueCategoryTable data={productCategoryData} totalRevenue={productRevenue.total} itemLabel="articles" />
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
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(p.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {productRevenue.total > 0 ? ((p.revenue / productRevenue.total) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                  {allProducts.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Aucune donnée</td></tr>
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
                    <tr key={row.staffId || idx} className="hover:bg-slate-50 transition-colors text-sm">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                            <Users size={12} className="text-slate-400" />
                          </div>
                          <span className={`font-medium ${row.staffId ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                            {row.staffName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(row.revenue)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{row.percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {revenueByStaffProducts.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">Aucune donnée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
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

const StaffServiceTable: React.FC<{ data: StaffServiceRow[]; totalRevenue: number }> = ({ data, totalRevenue }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
        Aucune donnée pour cette période
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-xs font-semibold text-slate-500 uppercase">
            <th className="px-4 py-3 w-8"></th>
            <th className="px-4 py-3">Membre</th>
            <th className="px-4 py-3 text-right">Prestations</th>
            <th className="px-4 py-3 text-right">CA</th>
            <th className="px-4 py-3 text-right">% du CA</th>
            <th className="px-4 py-3 text-right">Commission</th>
            <th className="px-4 py-3 text-right">Bonus</th>
            <th className="px-4 py-3 text-right">Panier Moyen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, idx) => {
            const key = row.staffId || `unassigned-${idx}`;
            const isExpanded = expandedIds.has(key);

            return (
              <React.Fragment key={key}>
                <tr
                  className="hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                  onClick={() => toggleExpand(key)}
                >
                  <td className="px-4 py-3 text-slate-400">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                        <Users size={12} className="text-slate-400" />
                      </div>
                      <span className={`font-medium ${row.staffId ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                        {row.staffName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(row.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{row.percent.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.commission > 0 ? formatPrice(row.commission) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.bonus > 0 ? formatPrice(row.bonus) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatPrice(row.avgBasket)}</td>
                </tr>
                {isExpanded && row.services.map((svc, sIdx) => (
                  <tr key={`${key}-${sIdx}`} className="bg-slate-50/50 text-sm">
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-slate-600 pl-8">
                      {svc.name}
                      {svc.variantName && <span className="text-slate-400 text-xs ml-1">({svc.variantName})</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">{svc.count}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{formatPrice(svc.revenue)}</td>
                    <td className="px-4 py-2 text-right text-slate-400">
                      {totalRevenue > 0 ? ((svc.revenue / totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"></td>
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
