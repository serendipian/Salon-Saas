import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Ban, RotateCcw } from 'lucide-react';
import { formatPrice } from '../../../lib/format';
import { VOID_CATEGORIES, REFUND_CATEGORIES } from '../../pos/constants';
import type { FinancesOutletContext } from '../FinancesLayout';
import type { Transaction } from '../../../types';

const CHART_COLORS = ['#0f172a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const getCategoryLabel = (key: string): string => {
  const void_ = VOID_CATEGORIES.find(c => c.key === key);
  if (void_) return void_.label;
  const refund_ = REFUND_CATEGORIES.find(c => c.key === key);
  if (refund_) return refund_.label;
  return key;
};

export const RefundsPage: React.FC = () => {
  const { filteredTransactions: transactions } = useOutletContext<FinancesOutletContext>();

  const { voids, refunds, stats, categoryData } = useMemo(() => {
    const voids = transactions.filter((t: Transaction) => t.type === 'VOID');
    const refunds = transactions.filter((t: Transaction) => t.type === 'REFUND');

    const totalVoided = voids.reduce((s: number, t: Transaction) => s + Math.abs(t.total), 0);
    const totalRefunded = refunds.reduce((s: number, t: Transaction) => s + Math.abs(t.total), 0);

    const catMap = new Map<string, number>();
    [...voids, ...refunds].forEach((t: Transaction) => {
      if (t.reasonCategory) {
        catMap.set(t.reasonCategory, (catMap.get(t.reasonCategory) || 0) + Math.abs(t.total));
      }
    });
    const categoryData = Array.from(catMap.entries())
      .map(([key, value]) => ({ name: getCategoryLabel(key), value }))
      .sort((a, b) => b.value - a.value);

    return {
      voids,
      refunds,
      stats: { totalVoided, totalRefunded, voidCount: voids.length, refundCount: refunds.length },
      categoryData,
    };
  }, [transactions]);

  const allEntries = [...voids, ...refunds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const saleCount = transactions.filter((t: Transaction) => t.type === 'SALE').length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Annulations</div>
          <div className="text-2xl font-bold text-red-600">{stats.voidCount}</div>
          <div className="text-sm text-slate-500 mt-1">{formatPrice(stats.totalVoided)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Remboursements</div>
          <div className="text-2xl font-bold text-orange-600">{stats.refundCount}</div>
          <div className="text-sm text-slate-500 mt-1">{formatPrice(stats.totalRefunded)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Total perdu</div>
          <div className="text-2xl font-bold text-slate-900">{formatPrice(stats.totalVoided + stats.totalRefunded)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Taux d'annulation</div>
          <div className="text-2xl font-bold text-slate-900">
            {saleCount > 0
              ? ((stats.voidCount + stats.refundCount) / saleCount * 100).toFixed(1)
              : '0'}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category pie chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Motifs</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatPrice(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {categoryData.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-slate-600">{c.name}</span>
                    </div>
                    <span className="font-medium text-slate-900">{formatPrice(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400 text-center py-8">Aucune donnée</div>
          )}
        </div>

        {/* Activity log */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Historique</h3>
          </div>
          {allEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <RotateCcw size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucune annulation ou remboursement sur cette période.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {allEntries.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-full ${entry.type === 'VOID' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                    {entry.type === 'VOID' ? <Ban size={14} /> : <RotateCcw size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entry.type === 'VOID' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {entry.type === 'VOID' ? 'Annulation' : 'Remboursement'}
                        </span>
                        <span className="text-sm text-slate-700 ml-2">{entry.clientName || 'Client de passage'}</span>
                      </div>
                      <span className="font-bold text-sm text-red-600">{formatPrice(Math.abs(entry.total))}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3">
                      <span>{new Date(entry.date).toLocaleString()}</span>
                      {entry.reasonCategory && <span>· {getCategoryLabel(entry.reasonCategory)}</span>}
                      {entry.createdByName && <span>· Par {entry.createdByName}</span>}
                      {entry.items.some(i => i.staffName) && (
                        <span>· Staff : {[...new Set(entry.items.filter(i => i.staffName).map(i => i.staffName))].join(', ')}</span>
                      )}
                    </div>
                    {entry.reasonNote && (
                      <div className="mt-1 text-xs text-slate-400 italic truncate">{entry.reasonNote}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
