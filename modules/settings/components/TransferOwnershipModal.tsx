import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import type { MemberRow } from '../hooks/useTeamSettings';

interface TransferOwnershipModalProps {
  members: MemberRow[];
  salonName: string;
  onConfirm: (newOwnerProfileId: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  members,
  salonName,
  onConfirm,
  onClose,
  isLoading,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const eligibleMembers = members.filter((m) => m.role !== 'owner' && m.status === 'active');
  const hasEligible = eligibleMembers.length > 0;
  const canConfirm = hasEligible && selectedProfileId && confirmText === salonName && !isLoading;

  return (
    <Modal isOpen onClose={onClose} title="Transférer la propriété" dismissible={!isLoading}>
      <div className="px-6 pb-6">
        {!hasEligible ? (
          // M-2: handle empty eligible members list
          <>
            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-5">
              <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                Aucun membre éligible pour le transfert. Invitez d'abord un autre manager ou
                styliste actif, puis réessayez.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg mb-5">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Vous serez rétrogradé au rôle de <strong>manager</strong>. Le nouveau propriétaire
                aura un contrôle total sur le salon.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="transfer-new-owner"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Nouveau propriétaire
                </label>
                <select
                  id="transfer-new-owner"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:opacity-60"
                >
                  <option value="">Sélectionner un membre...</option>
                  {eligibleMembers.map((m) => (
                    <option key={m.profile.id} value={m.profile.id}>
                      {m.profile.first_name} {m.profile.last_name} — {m.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="transfer-confirm-name"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Tapez <strong>{salonName}</strong> pour confirmer
                </label>
                <input
                  id="transfer-confirm-name"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isLoading}
                  placeholder={salonName}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-60"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => onConfirm(selectedProfileId)}
                disabled={!canConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 transition-colors"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Transférer
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
