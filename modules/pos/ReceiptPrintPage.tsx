import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { rawSelect } from '../../lib/supabaseRaw';
import { useSettings } from '../settings/hooks/useSettings';
import { ReceiptBody } from './components/ReceiptBody';
import { getTransactionStatus, type TransactionRow, toTransaction } from './mappers';
import type { Transaction } from '../../types';

/**
 * Chrome-less print view for a transaction receipt. Auto-opens the browser
 * print dialog once data is ready. Closing the tab is the cashier's job.
 */
export default function ReceiptPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { salonSettings } = useSettings();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allForStatus, setAllForStatus] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!id) {
      setError('Identifiant de transaction manquant.');
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await rawSelect<TransactionRow>(
          'transactions',
          `select=*,transaction_items(*),transaction_payments(*),clients(first_name,last_name),profiles(first_name,last_name)&id=eq.${id}`,
          controller.signal,
        );
        if (!rows[0]) {
          setError('Transaction introuvable.');
          return;
        }
        const mapped = toTransaction(rows[0]);
        setTx(mapped);

        // Fetch sibling void/refund rows so status (watermark) is correct
        const siblings = await rawSelect<TransactionRow>(
          'transactions',
          `select=*,transaction_items(*),transaction_payments(*),clients(first_name,last_name),profiles(first_name,last_name)&or=(id.eq.${id},original_transaction_id.eq.${id})`,
          controller.signal,
        );
        setAllForStatus(siblings.map(toTransaction));
      } catch (e) {
        // The effect cleanup aborts the in-flight fetch on unmount (and in
        // React Strict Mode's dev-only remount). Skip that noise so only real
        // failures surface as an error page.
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Erreur inconnue.');
      }
    })();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (tx) {
      const handle = requestAnimationFrame(() => window.print());
      return () => cancelAnimationFrame(handle);
    }
  }, [tx]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-700 bg-white min-h-screen">
        <h1 className="text-xl font-semibold mb-2">Impossible d'afficher le reçu</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white min-h-screen">
        Chargement du reçu…
      </div>
    );
  }

  const vatRate = salonSettings.vatRate || 20;
  const status = getTransactionStatus(tx, allForStatus);

  return (
    <div className="bg-white min-h-screen p-6 print:p-0">
      <style>{`
        @media print {
          @page { margin: 10mm; }
          body { background: white; }
        }
      `}</style>
      <div className="max-w-md mx-auto">
        <ReceiptBody
          tx={tx}
          salonName={salonSettings.name}
          salonAddress={salonSettings.address}
          salonPhone={salonSettings.phone}
          vatRate={vatRate}
          status={status}
        />
      </div>
    </div>
  );
}
