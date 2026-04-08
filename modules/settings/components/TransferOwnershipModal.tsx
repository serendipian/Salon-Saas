import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { MemberRow } from '../hooks/useTeamSettings';

interface TransferOwnershipModalProps {
  members: MemberRow[];
  salonName: string;
  onConfirm: (newOwnerProfileId: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  members, salonName, onConfirm, onClose, isLoading,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const eligibleMembers = members.filter(m => m.role !== 'owner' && m.status === 'active');
  const canConfirm = selectedProfileId && confirmText === salonName && !isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Transférer la propriété</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Vous serez rétrogradé au rôle de <strong>manager</strong>. Le nouveau propriétaire aura un contrôle total sur le salon.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nouveau propriétaire</label>
            <select
              value={selectedProfileId}
              onChange={e => setSelectedProfileId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">Sélectionner un membre...</option>
              {eligibleMembers.map(m => (
                <option key={m.profile.id} value={m.profile.id}>
                  {m.profile.first_name} {m.profile.last_name} — {m.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tapez <strong>{salonName}</strong> pour confirmer
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={salonName}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selectedProfileId)}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Transférer
          </button>
        </div>
      </div>
    </div>
  );
};
