import type React from 'react';
import { useEffect, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { CancellationReason } from '../../../types';

interface ReasonOption {
  code: CancellationReason;
  label: string;
  hint: string;
}

const REASON_OPTIONS: ReasonOption[] = [
  { code: CancellationReason.CANCELLED, label: 'Annulé', hint: 'Le rendez-vous n’aura pas lieu' },
  { code: CancellationReason.REPLACED, label: 'Remplacé', hint: 'Le service a été remplacé par un autre' },
  { code: CancellationReason.OFFERED, label: 'Offert', hint: 'Offert — ne sera pas facturé' },
  { code: CancellationReason.OTHER, label: 'Autre', hint: 'Préciser la raison dans la note' },
];

export interface CancelAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 'single' for one service, 'group' for a whole visit (multiple services). */
  scope: 'single' | 'group';
  /** Service name (single scope) or client name (group scope). Optional. */
  subjectLabel?: string;
  /** Count of services that will be cancelled when scope='group'. */
  count?: number;
  onConfirm: (reason: CancellationReason, note: string) => void | Promise<void>;
  isSubmitting?: boolean;
}

export const CancelAppointmentModal: React.FC<CancelAppointmentModalProps> = ({
  isOpen,
  onClose,
  scope,
  subjectLabel,
  count,
  onConfirm,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState<CancellationReason>(CancellationReason.CANCELLED);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(CancellationReason.CANCELLED);
      setNote('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (isSubmitting) return;
    void onConfirm(reason, note);
  };

  const noteRequired = reason === CancellationReason.OTHER;
  const canSubmit = !isSubmitting && (!noteRequired || note.trim().length > 0);

  const title =
    scope === 'group'
      ? `Annuler la visite${count && count > 1 ? ` (${count} services)` : ''}`
      : 'Annuler ce rendez-vous';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" dismissible={!isSubmitting}>
      <div className="px-6 pb-6 space-y-5">
        {subjectLabel && (
          <p className="text-sm text-slate-600">
            {scope === 'group' ? (
              <>
                Client : <span className="font-medium text-slate-900">{subjectLabel}</span>
              </>
            ) : (
              <>
                Service : <span className="font-medium text-slate-900">{subjectLabel}</span>
              </>
            )}
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700 mb-2">Motif</legend>
          <div className="grid grid-cols-1 gap-2">
            {REASON_OPTIONS.map((opt) => {
              const isActive = reason === opt.code;
              return (
                <label
                  key={opt.code}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={opt.code}
                    checked={isActive}
                    onChange={() => setReason(opt.code)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{opt.label}</span>
                    <span className="block text-xs text-slate-500">{opt.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="cancel-note" className="block text-sm font-medium text-slate-700 mb-1.5">
            Note {noteRequired ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(optionnel)</span>}
          </label>
          <textarea
            id="cancel-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
              noteRequired
                ? 'Préciser la raison...'
                : 'Détail supplémentaire (visible dans l’historique)'
            }
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm transition-all shadow-sm placeholder:text-slate-400 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Annulation...' : 'Confirmer l’annulation'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
