import { ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '../../../components/SafeResponsiveContainer';
import { formatPrice } from '../../../lib/format';
import type { ActivityChartPoint } from '../hooks/useRevenueActivityCharts';

interface RevenueActivityChartProps {
  title: string;
  data: ActivityChartPoint[];
  periodLabel?: string;
  onPrev?: () => void;
  onNext?: () => void;
  highlightIndex?: number;
}

export const RevenueActivityChart: React.FC<RevenueActivityChartProps> = ({
  title,
  data,
  periodLabel,
  onPrev,
  onNext,
  highlightIndex,
}) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {periodLabel && (
        <div className="flex items-center gap-1">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <span className="text-xs font-medium text-slate-500 min-w-[100px] text-center">
            {periodLabel}
          </span>
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: data.length > 15 ? 9 : 10 }}
            dy={data.length > 15 ? 2 : 6}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 10 }}
            width={45}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }}
            cursor={{ fill: '#f8fafc' }}
            formatter={(value) => [formatPrice(Number(value)), 'CA']}
            labelFormatter={(label) => String(label ?? '')}
          />
          <Bar
            dataKey="revenue"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
            minPointSize={0}
          >
            {highlightIndex !== undefined &&
              data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.revenue === 0
                      ? 'transparent'
                      : i === highlightIndex
                        ? '#3b82f6'
                        : '#93c5fd'
                  }
                />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);
