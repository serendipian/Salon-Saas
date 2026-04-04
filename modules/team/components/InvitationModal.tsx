import React from 'react';

interface InvitationModalProps {
  staffEmail?: string;
  staffRole: string;
  onSubmit: (email: string) => Promise<void>;
  onClose: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-xl p-6 text-slate-500" onClick={e => e.stopPropagation()}>
      Invitation modal — à implémenter
    </div>
  </div>
);
