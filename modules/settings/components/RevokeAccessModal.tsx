import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface RevokeAccessModalProps {
  memberName: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}

export const RevokeAccessModal: React.FC<RevokeAccessModalProps> = ({
  memberName, onConfirm, onClose, isLoading,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Révoquer l'accès</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">
          Cette action supprimera l'accès de <strong>{memberName}</strong> au salon et archivera son profil équipe associé. Cette action est irréversible.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirmer la révocation
        </button>
      </div>
    </div>
  </div>
);
