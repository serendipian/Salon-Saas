import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { formatPrice } from '../../../lib/format';

interface CategoryRow {
  categoryId: string;
  categoryName: string;
  count: number;
  revenue: number;
  items: { name: string; variantName?: string; count: number; revenue: number }[];
}

interface RevenueCategoryTableProps {
  data: CategoryRow[];
  totalRevenue: number;
  itemLabel?: string; // "prestations" or "articles"
}

type SortKey = 'categoryName' | 'count' | 'revenue' | 'avgBasket';
type SortDir = 'asc' | 'desc';

export const RevenueCategoryTable: React.FC<RevenueCategoryTableProps> = ({
  data,
  totalRevenue,
  itemLabel = 'prestations',
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'categoryName' ? 'asc' : 'desc');
    }
  };

  const totalCount = data.reduce((sum, cat) => sum + cat.count, 0);

  const sortedData = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'categoryName') {
        return a.categoryName.localeCompare(b.categoryName) * dir;
      }
      if (sortKey === 'count') return (a.count - b.count) * dir;
      if (sortKey === 'revenue') return (a.revenue - b.revenue) * dir;
      // avgBasket
      const aAvg = a.count > 0 ? a.revenue / a.count : 0;
      const bAvg = b.count > 0 ? b.revenue / b.count : 0;
      return (aAvg - bAvg) * dir;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const maxRevenue = useMemo(
    () => sortedData.reduce((m, c) => Math.max(m, c.revenue), 0),
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
    sortableKey: SortKey;
    align?: 'left' | 'right';
  }> = ({ label, sortableKey, align = 'right' }) => {
    const active = sortKey === sortableKey;
    return (
      <th
        className={`px-5 py-4 ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
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
            <SortHeader label="Catégorie" sortableKey="categoryName" align="left" />
            <SortHeader label={`Nb ${itemLabel}`} sortableKey="count" />
            <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              % {itemLabel}
            </th>
            <SortHeader label="CA" sortableKey="revenue" />
            <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              % du CA
            </th>
            <SortHeader label="Panier Moyen" sortableKey="avgBasket" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedData.map((cat, idx) => {
            const isExpanded = expandedIds.has(cat.categoryId);
            const percent = totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0;
            const barWidth = maxRevenue > 0 ? (cat.revenue / maxRevenue) * 100 : 0;
            const rank = idx + 1;

            return (
              <React.Fragment key={cat.categoryId}>
                <tr
                  className="hover:bg-blue-50/40 transition-all cursor-pointer text-sm group"
                  onClick={() => toggleExpand(cat.categoryId)}
                >
                  <td className="pl-4 pr-2 py-4 w-12">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold ${
                          rank <= 3
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-50 text-slate-400'
                        }`}
                      >
                        {rank}
                      </span>
                      <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{cat.categoryName}</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">
                    {cat.count}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-500">
                    {totalCount > 0 ? ((cat.count / totalCount) * 100).toFixed(1) : '0.0'}%
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
                        {formatPrice(cat.revenue)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-500">{percent.toFixed(1)}%</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">
                    {cat.count > 0 ? formatPrice(cat.revenue / cat.count) : '—'}
                  </td>
                </tr>
                {isExpanded &&
                  cat.items.map((item, i) => (
                    <tr key={`${cat.categoryId}-${i}`} className="bg-slate-50/60 text-sm">
                      <td className="px-4 py-3"></td>
                      <td className="px-5 py-3 text-slate-600 pl-10">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          {item.name}
                          {item.variantName && (
                            <span className="text-slate-400 text-xs">({item.variantName})</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-600">
                        {item.count}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400">
                        {totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-600">
                        {formatPrice(item.revenue)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400">
                        {totalRevenue > 0
                          ? ((item.revenue / totalRevenue) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-600">
                        {item.count > 0 ? formatPrice(item.revenue / item.count) : '—'}
                      </td>
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
