import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatPrice } from '../../../lib/format';

interface KpiItem {
  title: string;
  value: number | string;
  format?: 'price' | 'number' | 'percent' | 'raw';
  trend?: number | null;
  invertTrend?: boolean; // true = lower is better (e.g., expenses)
  subtitle?: string;
}

interface MiniKpiRowProps {
  items: KpiItem[];
}

export const MiniKpiRow: React.FC<MiniKpiRowProps> = ({ items }) => {
  const formatValue = (value: number | string, format?: string) => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'price': return formatPrice(value);
      case 'percent': return `${value.toFixed(1)}%`;
      case 'number': return value.toLocaleString('fr-FR');
      default: return formatPrice(value);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {items.map((item, idx) => {
        const isPositive = item.trend != null
          ? item.invertTrend ? item.trend <= 0 : item.trend >= 0
          : true;

        return (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{item.title}</span>
              {item.trend != null && (
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {Math.abs(item.trend).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatValue(item.value, item.format)}
            </div>
            {item.subtitle && <div className="text-[11px] text-slate-400 mt-1">{item.subtitle}</div>}
          </div>
        );
      })}
    </div>
  );
};
