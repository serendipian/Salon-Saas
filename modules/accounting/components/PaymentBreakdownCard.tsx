import { ArrowDownRight, ArrowUpRight, DollarSign, Minus, Wallet } from 'lucide-react';
import type React from 'react';
import { formatPrice } from '../../../lib/format';
import { PAYMENT_METHOD_COLORS, PAYMENT_METHOD_ICONS } from './paymentMethodConstants';

interface PaymentBreakdownCardProps {
  title: string;
  total: number;
  trend: number;
  methods: { method: string; amount: number; percent: number }[];
}

export const PaymentBreakdownCard: React.FC<PaymentBreakdownCardProps> = ({
  title,
  total,
  trend,
  methods,
}) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
    <div className="flex items-center gap-2.5 mb-1">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <DollarSign size={16} className="text-blue-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
    </div>
    <div className="text-2xl font-bold text-slate-900 tracking-tight">{formatPrice(total)}</div>
    <div className="flex items-center gap-2 mt-1 mb-4">
      {trend !== null && (
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
            Math.abs(trend) < 0.05
              ? 'bg-slate-50 text-slate-500'
              : trend >= 0
                ? 'bg-blue-50 text-blue-700'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {Math.abs(trend) < 0.05 ? (
            <Minus size={12} />
          ) : trend >= 0 ? (
            <ArrowUpRight size={12} />
          ) : (
            <ArrowDownRight size={12} />
          )}
          {Math.abs(trend).toFixed(1)}%
        </span>
      )}
      <span className="text-xs text-slate-400">vs période préc.</span>
    </div>
    <div className="space-y-2 pt-3 border-t border-slate-100">
      {methods.map(({ method, amount, percent }) => {
        const Icon = PAYMENT_METHOD_ICONS[method] || Wallet;
        const colorClass = PAYMENT_METHOD_COLORS[method] || 'bg-slate-50 text-slate-600';
        const isIdle = amount === 0;
        return (
          <div key={method} className={`flex items-center gap-2.5 ${isIdle ? 'opacity-40' : ''}`}>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
            >
              <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-medium text-slate-600 truncate">{method}</span>
                <span className="text-xs font-bold text-slate-800 ml-2 shrink-0">
                  {formatPrice(amount)}
                </span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">
              {percent.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  </div>
);
