import { CheckCircle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { formatPrice, formatTicketNumber } from '../../../lib/format';
import type { Transaction } from '../../../types';
import { PAYMENT_METHOD_SHORT } from '../constants';

interface TransactionSuccessModalProps {
  tx: Transaction | null;
  onClose: () => void;
}

function formatPaymentMethods(tx: Transaction): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const p of tx.payments) {
    const short = PAYMENT_METHOD_SHORT[p.method] ?? p.method;
    if (!seen.has(short)) {
      seen.add(short);
      labels.push(short);
    }
  }
  return labels.join(' + ');
}

function totalArticles(tx: Transaction): number {
  return tx.items.reduce((sum, it) => sum + it.quantity, 0);
}

export function TransactionSuccessModal({ tx, onClose }: TransactionSuccessModalProps) {
  const { isMobile } = useMediaQuery();
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll + handle Escape
  useEffect(() => {
    if (!tx) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [tx, onClose]);

  // Initial focus on primary action
  useEffect(() => {
    if (tx) primaryButtonRef.current?.focus();
  }, [tx]);

  // Focus trap: Tab cycles through tabbable elements inside the modal
  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = modalRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tx]);

  if (!tx) return null;

  const handlePrint = () => {
    window.open(`/pos/historique/${tx.id}/print`, '_blank', 'noopener,noreferrer');
    // Intentionally do NOT close — cashier can print, then tap Nouvelle vente.
  };

  const backdropClass = isMobile
    ? 'fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300'
    : 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4';

  const panelClass = isMobile
    ? 'flex flex-col w-full h-full'
    : 'bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col';

  return createPortal(
    <div
      className={backdropClass}
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={(e) => {
        // Backdrop click closes on desktop only
        if (!isMobile && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-success-heading"
    >
      <div ref={modalRef} className={panelClass}>
        {/* Close (X) */}
        <div className="flex justify-end p-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 flex-1 flex flex-col items-center text-center">
          <div
            id="tx-success-heading"
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-2 mb-6"
          >
            <CheckCircle size={48} className="text-emerald-500" />
            <div className="text-lg font-medium text-slate-900">Transaction enregistrée</div>
            <div className="font-mono text-slate-600 text-base">
              {formatTicketNumber(tx.ticketNumber)}
            </div>
          </div>

          <div className="text-4xl font-bold text-slate-900 mb-4">{formatPrice(tx.total)}</div>

          <div className="text-sm text-slate-600 mb-1">
            {totalArticles(tx)} article{totalArticles(tx) > 1 ? 's' : ''} ·{' '}
            {formatPaymentMethods(tx)}
          </div>

          {tx.clientName && (
            <div className="text-sm text-slate-500 mb-4">{tx.clientName}</div>
          )}
        </div>

        {/* Footer buttons */}
        <div
          className="px-6 pb-6 flex flex-col gap-3 shrink-0"
          style={
            isMobile
              ? { paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }
              : undefined
          }
        >
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={handlePrint}
            className="w-full min-h-[44px] px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            Imprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
          >
            Nouvelle vente
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
