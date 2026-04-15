import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
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

export const RevenueCategoryTable: React.FC<RevenueCategoryTableProps> = ({
  data,
  totalRevenue,
  itemLabel = 'prestations',
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
            <th className="px-4 py-3">Catégorie</th>
            <th className="px-4 py-3 text-right">Nb {itemLabel}</th>
            <th className="px-4 py-3 text-right">CA</th>
            <th className="px-4 py-3 text-right">% du total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((cat) => {
            const isExpanded = expandedIds.has(cat.categoryId);
            const percent = totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0;

            return (
              <React.Fragment key={cat.categoryId}>
                <tr
                  className="hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                  onClick={() => toggleExpand(cat.categoryId)}
                >
                  <td className="px-4 py-3 text-slate-400">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{cat.categoryName}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{cat.count}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatPrice(cat.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{percent.toFixed(1)}%</td>
                </tr>
                {isExpanded &&
                  cat.items.map((item, idx) => (
                    <tr key={`${cat.categoryId}-${idx}`} className="bg-slate-50/50 text-sm">
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2 text-slate-600 pl-8">
                        {item.name}
                        {item.variantName && (
                          <span className="text-slate-400 text-xs ml-1">({item.variantName})</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">{item.count}</td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {formatPrice(item.revenue)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-400">
                        {totalRevenue > 0
                          ? ((item.revenue / totalRevenue) * 100).toFixed(1)
                          : '0.0'}
                        %
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
