import type React from 'react';
import { formatPrice } from '../../../lib/format';

/**
 * Renders an appointment's price as either a single number (when nothing
 * changed) or a "was → became" diff with a Modifié badge. Shared by the
 * detail view, the list table, and the card list.
 *
 * Variants:
 *  - large=true   → 2xl bold (used in the AppointmentDetails header card)
 *  - cancelled    → strike-through final price, no diff treatment
 *  - compact=true → smaller padding/typography for table/card row use
 */
export const PriceDisplay: React.FC<{
  price: number;
  originalPrice?: number | null;
  cancelled?: boolean;
  large?: boolean;
  compact?: boolean;
  align?: 'start' | 'end';
}> = ({ price, originalPrice, cancelled, large, compact, align = 'end' }) => {
  const changed = originalPrice != null && originalPrice !== price;
  const justify = align === 'end' ? 'justify-end' : 'justify-start';

  if (cancelled) {
    return (
      <span
        className={`${large ? 'text-2xl font-bold' : 'text-sm font-semibold'} text-slate-400 line-through`}
      >
        {formatPrice(price)}
      </span>
    );
  }

  if (!changed) {
    return (
      <span
        className={
          large
            ? 'text-2xl font-bold text-slate-900'
            : compact
              ? 'text-sm font-semibold text-slate-900 tabular-nums'
              : 'text-sm font-semibold text-blue-600'
        }
      >
        {formatPrice(price)}
      </span>
    );
  }

  if (compact) {
    // Stack vertically for table/card rows — keeps the column width predictable
    return (
      <span className={`flex flex-col items-${align === 'end' ? 'end' : 'start'} leading-tight`}>
        <span className="text-[11px] text-slate-400 line-through tabular-nums">
          {formatPrice(originalPrice)}
        </span>
        <span className="text-sm font-semibold text-slate-900 tabular-nums flex items-center gap-1">
          {formatPrice(price)}
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-500"
            aria-label="Prix modifié"
            title="Prix modifié"
          />
        </span>
      </span>
    );
  }

  return (
    <span className={`flex items-baseline gap-2 flex-wrap ${justify}`}>
      <span className={`${large ? 'text-base' : 'text-xs'} text-slate-400 line-through`}>
        {formatPrice(originalPrice)}
      </span>
      <span className={large ? 'text-2xl font-bold text-slate-900' : 'text-sm font-semibold text-blue-600'}>
        {formatPrice(price)}
      </span>
      <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
        Modifié
      </span>
    </span>
  );
};
