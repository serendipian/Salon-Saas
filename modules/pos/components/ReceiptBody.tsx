import type { Transaction } from '../../../types';
import { formatPrice, formatTicketNumber } from '../../../lib/format';
import type { TransactionStatus } from '../mappers';

interface ReceiptBodyProps {
  tx: Transaction;
  salonName: string;
  salonAddress?: string;
  salonPhone?: string;
  vatRate: number;
  status: TransactionStatus;
}

/**
 * Pure presentational receipt body. Rendered inside ReceiptModal on screen
 * and inside ReceiptPrintPage in a chrome-less print page. Wrapping
 * components own the header and footer/action buttons.
 */
export function ReceiptBody({
  tx,
  salonName,
  salonAddress,
  salonPhone,
  vatRate,
  status,
}: ReceiptBodyProps) {
  const totalPaid = tx.payments.reduce((acc, p) => acc + p.amount, 0);
  const change = Math.max(0, totalPaid - tx.total);
  // VAT base is services+products (tx.total) only — tips are personal
  // compensation, not business revenue, so they don't enter the VAT formula.
  const vatAmount = (tx.total * (vatRate / 100)) / (1 + vatRate / 100);
  const tips = tx.tips ?? [];
  const tipsTotal = tips.reduce((sum, t) => sum + t.amount, 0);
  const grandTotal = tx.total + tipsTotal;
  const watermark =
    status === 'voided' ? 'ANNULÉ' : status === 'fully_refunded' ? 'REMBOURSÉ' : null;

  // Map wire codes back to French labels for display (mirrors mappers.ts)
  const methodLabel: Record<string, string> = {
    CASH: 'Espèces',
    CARD: 'Carte',
    TRANSFER: 'Virement',
    CHECK: 'Chèque',
    MOBILE: 'Mobile',
    OTHER: 'Autre',
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-lg text-center relative overflow-hidden">
      {watermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-5xl font-black text-red-200 -rotate-12 select-none opacity-60">
            {watermark}
          </span>
        </div>
      )}
      <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-xl mx-auto mb-3">
        {salonName.charAt(0)}
      </div>
      <h2 className="font-bold text-slate-900 text-lg">{salonName}</h2>
      {salonAddress && <p className="text-xs text-slate-500 mt-1">{salonAddress}</p>}
      {salonPhone && <p className="text-xs text-slate-500">{salonPhone}</p>}

      <div className="mt-4 mb-6 text-xs text-slate-400">
        <div>{new Date(tx.date).toLocaleString()}</div>
        <div className="uppercase mt-1 font-mono">{formatTicketNumber(tx.ticketNumber)}</div>
      </div>

      <div className="text-left space-y-4 mb-6">
        {tx.items.map((item, idx) => (
          <div
            key={idx}
            className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0"
          >
            <div>
              <div className="font-bold text-slate-800">{item.name}</div>
              {item.variantName && <div className="text-xs text-slate-500">{item.variantName}</div>}
              <div className="text-xs text-slate-400">
                {item.quantity} x {formatPrice(item.price)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold">{formatPrice(item.price * item.quantity)}</div>
              {item.originalPrice && item.originalPrice > item.price && (
                <div className="text-xs text-slate-400 line-through">
                  {formatPrice(item.originalPrice * item.quantity)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-dashed border-slate-200 pt-4 space-y-1">
        <div className="flex justify-between text-slate-500 text-xs mb-2">
          <span>TVA ({vatRate}%)</span>
          <span>{formatPrice(vatAmount)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-slate-900">
          <span>TOTAL</span>
          <span>{formatPrice(tx.total)}</span>
        </div>
      </div>

      {tips.length > 0 && (
        <div className="mt-4 border-t-2 border-dashed border-slate-200 pt-4 text-left">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
            Pourboires
          </div>
          <div className="space-y-1.5">
            {tips.map((tip) => (
              <div key={tip.id} className="flex justify-between text-sm">
                <span className="text-slate-700">
                  {tip.staffName ?? <em className="text-slate-400">Pourboire (staff supprimé)</em>}{' '}
                  <span className="text-xs text-slate-400">({methodLabel[tip.method] ?? tip.method})</span>
                </span>
                <span className="font-medium text-slate-800 tabular-nums">
                  {formatPrice(tip.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700">Total pourboires</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatPrice(tipsTotal)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1.5 mt-1.5 border-t-2 border-dashed border-slate-200">
              <span>TOTAL AVEC POURBOIRES</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {change > 0 && (
        <div className="mt-4 flex justify-between bg-emerald-50 p-3 rounded-lg text-emerald-700 text-sm font-bold">
          <span>Monnaie rendue</span>
          <span>{formatPrice(change)}</span>
        </div>
      )}
    </div>
  );
}
