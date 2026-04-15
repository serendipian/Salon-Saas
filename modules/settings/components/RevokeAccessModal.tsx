import React from 'react';
import { ConfirmModal } from '../../../components/ConfirmModal';

interface RevokeAccessModalProps {
  memberName: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}

export const RevokeAccessModal: React.FC<RevokeAccessModalProps> = ({
  memberName,
  onConfirm,
  onClose,
  isLoading,
}) => (
  <ConfirmModal
    isOpen
    title="Révoquer l'accès"
    tone="danger"
    confirmLabel="Confirmer la révocation"
    isLoading={isLoading}
    onConfirm={onConfirm}
    onClose={onClose}
    message={
      <>
        Cette action supprimera l'accès de <strong>{memberName}</strong> au salon et archivera son
        profil équipe associé. Cette action est irréversible.
      </>
    }
  />
);
