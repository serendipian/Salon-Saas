import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, RotateCcw, Package } from 'lucide-react';
import { Transaction, CartItem } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { REFUND_CATEGORIES } from '../constants';
import { getRefundedAmount } from '../mappers';

interface RefundItem {
  originalItemId: string;
  item: CartItem;
  maxQuantity: number;
  selectedQuantity: number;
  selected: boolean;
}

interface RefundModalProps {
  transaction: Transaction;
  allTransactions: Transaction[];
  onConfirm: (
    items: {
      original_item_id: string | null;
      quantity: number;
      price_override?: number;
      price?: number;
      name?: string;
    }[],
    payments: { method: string; amount: number }[],
    reasonCategory: string,
    reasonNote: string,
    restock: boolean,
  ) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'CARD', label: 'Carte Bancaire' },
  { value: 'TRANSFER', label: 'Virement' },
  { value: 'CHECK', label: 'Chèque' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'OTHER', label: 'Autre' },
];

export const RefundModal: React.FC<RefundModalProps> = ({
  transaction,
  allTransactions,
  onConfirm,
  onClose,
  isPending,
}) => {
  const { isMobile } = useMediaQuery();
  const [step, setStep] = useState<1 | 2>(1);
  const [manualMode, setManualMode] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [restock, setRestock] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const refundItems = useMemo<RefundItem[]>(() => {
    const refundTransactions = allTransactions.filter(
      (t) => t.type === 'REFUND' && t.originalTransactionId === transaction.id,
    );

    return transaction.items.map((item) => {
      const alreadyRefunded = refundTransactions.reduce((sum, rt) => {
        const matchingItems = rt.items.filter((ri) => ri.originalItemId === item.id);
        return sum + matchingItems.reduce((s, ri) => s + ri.quantity, 0);
      }, 0);

      return {
        originalItemId: item.id,
        item,
        maxQuantity: item.quantity - alreadyRefunded,
        selectedQuantity: 0,
        selected: false,
      };
    });
  }, [transaction, allTransactions]);

  const [items, setItems] = useState(refundItems);

  // Re-sync items when allTransactions changes (e.g., another user refunds the same transaction)
  useEffect(() => {
    setItems(refundItems);
  }, [refundItems]);

  const totalAlreadyRefunded = getRefundedAmount(transaction.id, allTransactions);
  const maxRefundable = transaction.total - totalAlreadyRefunded;

  const toggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const selected = !it.selected;
        return { ...it, selected, selectedQuantity: selected ? it.maxQuantity : 0 };
      }),
    );
  };

  const setQuantity = (idx: number, qty: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              selectedQuantity: Math.min(Math.max(0, qty), it.maxQuantity),
              selected: qty > 0,
            }
          : it,
      ),
    );
  };

  const selectedTotal = manualMode
    ? Math.min(parseFloat(manualAmount) || 0, maxRefundable)
    : items.reduce((sum, it) => (it.selected ? sum + it.item.price * it.selectedQuantity : sum), 0);

  const hasProducts = items.some((it) => it.selected && it.item.type === 'PRODUCT');
  const canProceed = manualMode
    ? selectedTotal > 0 && selectedTotal <= maxRefundable
    : selectedTotal > 0;
  const canSubmit = canProceed && category.length > 0 && note.trim().length > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    let refundItemsPayload: {
      original_item_id: string | null;
      quantity: number;
      price_override?: number;
      price?: number;
      name?: string;
    }[];

    if (manualMode) {
      refundItemsPayload = [
        {
          original_item_id: null,
          quantity: 1,
          price: selectedTotal,
          name: 'Remboursement partiel',
        },
      ];
    } else {
      refundItemsPayload = items
        .filter((it) => it.selected && it.selectedQuantity > 0)
        .map((it) => ({ original_item_id: it.originalItemId, quantity: it.selectedQuantity }));
    }

    const payments = [{ method: paymentMethod, amount: selectedTotal }];
    await onConfirm(refundItemsPayload, payments, category, note.trim(), restock);
  };

  const originalPayments = transaction.payments.map((p) => p.method).join(', ');

  const step1Content = (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setManualMode(false)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${!manualMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Par article
        </button>
        <button
          onClick={() => setManualMode(true)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${manualMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Montant personnalisé
        </button>
      </div>

      {totalAlreadyRefunded > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Déjà remboursé : {formatPrice(totalAlreadyRefunded)} / {formatPrice(transaction.total)} —
          Restant : {formatPrice(maxRefundable)}
        </div>
      )}

      {manualMode ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Montant à rembourser *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={maxRefundable}
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder={`Max ${formatPrice(maxRefundable)}`}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px]"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((ri, idx) => (
            <div
              key={ri.originalItemId}
              className={`border rounded-lg p-3 transition-colors ${ri.maxQuantity === 0 ? 'bg-slate-50 opacity-50' : ri.selected ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={ri.selected}
                  onChange={() => toggleItem(idx)}
                  disabled={ri.maxQuantity === 0}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm text-slate-900">{ri.item.name}</div>
                      {ri.item.variantName && (
                        <div className="text-xs text-slate-500">{ri.item.variantName}</div>
                      )}
                      {ri.item.staffName && (
                        <div className="text-xs text-blue-600 mt-0.5">{ri.item.staffName}</div>
                      )}
                    </div>
                    <span className="font-semibold text-sm text-slate-900 ml-2">
                      {formatPrice(ri.item.price * ri.selectedQuantity)}
                    </span>
                  </div>
                  {ri.maxQuantity === 0 ? (
                    <div className="text-xs text-slate-400 mt-1">Entièrement remboursé</div>
                  ) : ri.item.quantity > 1 ? (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-500">Qté :</span>
                      <button
                        onClick={() => setQuantity(idx, ri.selectedQuantity - 1)}
                        className="w-7 h-7 rounded border border-slate-300 flex items-center justify-center text-sm hover:bg-slate-100"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium w-6 text-center">
                        {ri.selectedQuantity}
                      </span>
                      <button
                        onClick={() => setQuantity(idx, ri.selectedQuantity + 1)}
                        className="w-7 h-7 rounded border border-slate-300 flex items-center justify-center text-sm hover:bg-slate-100"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-400">/ {ri.maxQuantity}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restock toggle */}
      {hasProducts && !manualMode && (
        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={restock}
            onChange={(e) => setRestock(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          />
          <div>
            <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <Package size={14} /> Remettre en stock
            </div>
            <div className="text-xs text-slate-500">Les produits seront ajoutés à l'inventaire</div>
          </div>
        </label>
      )}

      {/* Refund total */}
      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
        <span className="font-medium text-slate-700 text-sm">Total remboursement</span>
        <span className="font-bold text-lg text-orange-600">{formatPrice(selectedTotal)}</span>
      </div>

      <button
        onClick={() => setStep(2)}
        disabled={!canProceed}
        className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        Suivant
      </button>
    </div>
  );

  const step2Content = (
    <div className="space-y-5">
      <button
        onClick={() => setStep(1)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      {/* Refund summary */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-medium text-orange-800 text-sm">Montant à rembourser</span>
          <span className="font-bold text-lg text-orange-700">{formatPrice(selectedTotal)}</span>
        </div>
      </div>

      {/* Original payment for reference */}
      <div className="text-xs text-slate-500">
        Paiement original : <span className="font-medium">{originalPayments}</span>
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Mode de remboursement *
        </label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px]"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Reason category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif *</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px]"
        >
          <option value="">Sélectionner un motif...</option>
          {REFUND_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Commentaire *</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Décrivez la raison du remboursement..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        {isPending ? 'Remboursement en cours...' : 'Confirmer le remboursement'}
      </button>
    </div>
  );

  const modalContent = step === 1 ? step1Content : step2Content;
  const title = step === 1 ? 'Rembourser — Articles' : 'Rembourser — Paiement';

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto p-5"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          {modalContent}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{modalContent}</div>
      </div>
    </div>
  );
};
