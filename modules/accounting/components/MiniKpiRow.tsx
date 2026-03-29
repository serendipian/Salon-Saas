import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatPrice } from '../../../lib/format';

export interface KpiItem {
  title: string;
  value: number | string;
  format?: 'price' | 'number' | 'percent' | 'raw';
  trend?: number | null;
  invertTrend?: boolean; // true = lower is better (e.g., expenses)
  subtitle?: string;
}

interface MiniKpiRowProps {
  items: KpiItem[];
  columns?: number;
}

const formatValue = (value: number | string, format?: string) => {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'price': return formatPrice(value);
    case 'percent': return `${value.toFixed(1)}%`;
    case 'number': return value.toLocaleString('fr-FR');
    default: return formatPrice(value);
  }
};

export const TrendBadge: React.FC<{ trend: number; invertTrend?: boolean }> = ({ trend, invertTrend }) => {
  if (trend === 0) {
    return (
      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 bg-slate-50 text-slate-500">
        <Minus size={10} />0.0%
      </span>
    );
  }
  const isPositive = invertTrend ? trend < 0 : trend > 0;
  return (
    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
      isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}>
      {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(trend).toFixed(1)}%
    </span>
  );
};

export const KpiCard: React.FC<KpiItem> = ({ title, value, format, trend, invertTrend, subtitle }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <div className="flex justify-between items-start mb-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</span>
      {trend != null && <TrendBadge trend={trend} invertTrend={invertTrend} />}
    </div>
    <div className="text-xl font-bold text-slate-900 tracking-tight">
      {formatValue(value, format)}
    </div>
    {subtitle && <div className="text-[11px] text-slate-400 mt-1">{subtitle}</div>}
  </div>
);

export const MiniKpiRow: React.FC<MiniKpiRowProps> = ({ items, columns }) => {
  const colClass = columns === 4
    ? 'grid-cols-2 lg:grid-cols-4'
    : columns === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-3';

  return (
    <div className={`grid ${colClass} gap-4 mb-6`}>
      {items.map((item, idx) => (
        <KpiCard key={idx} {...item} />
      ))}
    </div>
  );
};
