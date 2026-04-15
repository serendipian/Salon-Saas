import { AlertTriangle, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { formatPrice } from '../../../lib/format';
import type { Transaction } from '../../../types';
import { VOID_CATEGORIES } from '../constants';

interface VoidModalProps {
  transaction: Transaction;
  onConfirm: (reasonCategory: string, reasonNote: string) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}

export const VoidModal: React.FC<VoidModalProps> = ({
  transaction,
  onConfirm,
  onClose,
  isPending,
}) => {
  const { isMobile } = useMediaQuery();
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const canSubmit = category.length > 0 && note.trim().length > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onConfirm(category, note.trim());
  };

  const content = (
    <div className="space-y-5">
      {/* Warning */}
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">
          <p className="font-semibold">Annulation définitive</p>
          <p className="mt-1">
            Cette action va créer une écriture d'annulation. La transaction originale restera
            visible dans l'historique.
          </p>
        </div>
      </div>

      {/* Transaction summary */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Client</span>
          <span className="font-medium text-slate-900">
            {transaction.clientName || 'Client de passage'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Articles</span>
          <span className="text-slate-700">
            {transaction.items.length} article{transaction.items.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span className="text-slate-700">Total</span>
          <span className="text-slate-900">{formatPrice(transaction.total)}</span>
        </div>
      </div>

      {/* Reason category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif *</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[44px]"
        >
          <option value="">Sélectionner un motif...</option>
          {VOID_CATEGORIES.map((c) => (
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
          placeholder="Décrivez la raison de l'annulation..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        {isPending ? 'Annulation en cours...' : "Confirmer l'annulation"}
      </button>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Annuler la transaction"
        className="fixed inset-0 bg-white flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ zIndex: 'var(--z-modal)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-900">Annuler la transaction</h3>
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
          {content}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">Annuler la transaction</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{content}</div>
      </div>
    </div>
  );
};
