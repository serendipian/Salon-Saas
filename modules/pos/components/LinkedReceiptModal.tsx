// modules/pos/components/LinkedReceiptModal.tsx
//
// In-tab receipt viewer used from AppointmentDetails. Fetches the
// transaction (and its void/refund siblings for status resolution) on
// mount, renders the receipt body inside a modal shell, and offers
// Print + Email + Close actions.
//
// Why a separate component from POSModals.ReceiptModal:
// - ReceiptModal requires the parent to pass `allTransactions` (so the
//   POSModule's already-loaded list resolves void/refund status without
//   extra queries). AppointmentDetails has no such list — it would have
//   to load 30 days of transactions just to show one receipt.
// - This component owns its own minimal fetch (the linked transaction +
//   any rows that void/refund it), keeping AppointmentDetails clean.
// - Print still uses the existing /pos/historique/:id/print route in a
//   new tab (that's the actual print-action path, used elsewhere too).
// - Email button is a placeholder — the wire-up to email delivery is
//   intentionally deferred per spec.

import { Mail, Printer, Receipt, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { rawSelect } from '../../../lib/supabaseRaw';
import { formatTicketNumber } from '../../../lib/format';
import { useSettings } from '../../settings/hooks/useSettings';
import { type TransactionRow, getTransactionStatus, toTransaction } from '../mappers';
import { ReceiptBody } from './ReceiptBody';
import type { Transaction } from '../../../types';

interface LinkedReceiptModalProps {
  transactionId: string;
  onClose: () => void;
}

export const LinkedReceiptModal: React.FC<LinkedReceiptModalProps> = ({
  transactionId,
  onClose,
}) => {
  const { salonSettings } = useSettings();
  const { isMobile } = useMediaQuery();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [siblings, setSiblings] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape regardless of modal layout
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fetch the transaction + its void/refund siblings
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await rawSelect<TransactionRow>(
          'transactions',
          `select=*,transaction_items(*),transaction_payments(*),clients(first_name,last_name),profiles(first_name,last_name)&id=eq.${transactionId}`,
          controller.signal,
        );
        if (!rows[0]) {
          setError('Transaction introuvable.');
          return;
        }
        setTx(toTransaction(rows[0]));

        const sibs = await rawSelect<TransactionRow>(
          'transactions',
          `select=*,transaction_items(*),transaction_payments(*),clients(first_name,last_name),profiles(first_name,last_name)&or=(id.eq.${transactionId},original_transaction_id.eq.${transactionId})`,
          controller.signal,
        );
        setSiblings(sibs.map(toTransaction));
      } catch (e) {
        // The effect cleanup aborts the in-flight fetch — same pattern as
        // ReceiptPrintPage. AbortError is a deliberate cleanup, not a
        // user-facing failure.
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Erreur inconnue.');
      }
    })();
    return () => controller.abort();
  }, [transactionId]);

  const handlePrint = () => {
    window.open(`/pos/historique/${transactionId}/print`, '_blank', 'noopener,noreferrer');
  };

  const vatRate = salonSettings.vatRate || 20;
  const status = tx ? getTransactionStatus(tx, siblings) : null;

  const ticketLabel = tx ? formatTicketNumber(tx.ticketNumber) : '';

  const body = (
    <>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Receipt size={18} />
          Ticket{tx && <span className="font-mono text-slate-500"> {ticketLabel}</span>}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {error ? (
          <div className="text-center text-red-700 py-12">{error}</div>
        ) : tx && status ? (
          <ReceiptBody
            tx={tx}
            salonName={salonSettings.name}
            salonAddress={salonSettings.address}
            salonPhone={salonSettings.phone}
            vatRate={vatRate}
            status={status}
          />
        ) : (
          <div className="text-center text-slate-500 py-12">Chargement du reçu…</div>
        )}
      </div>

      <div
        className="shrink-0 px-5 py-4 border-t border-slate-200 bg-white flex gap-3"
        style={{ paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : undefined }}
      >
        <button
          type="button"
          onClick={handlePrint}
          disabled={!tx}
          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
        >
          <Printer size={16} />
          Imprimer
        </button>
        <button
          type="button"
          disabled
          title="Bientôt disponible"
          className="flex-1 py-3 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Mail size={16} />
          Envoyer par email
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
        >
          Fermer
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ticket de caisse"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        {body}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ticket de caisse"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
};
