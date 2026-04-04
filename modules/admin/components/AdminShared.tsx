// modules/admin/components/AdminShared.tsx
import React from 'react';
import { Plus } from 'lucide-react';

// Reusable filter chip (visual only — for use as search filters)
export const FilterChip: React.FC<{ label: string; onClick?: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] border border-[#e3e8ef] rounded-full hover:bg-[#f7fafc] transition-colors"
    style={{ color: '#3c4257' }}
  >
    <Plus className="w-3 h-3" />
    {label}
  </button>
);

// Reusable loading state
export const AdminLoadingState: React.FC = () => (
  <div className="flex items-center justify-center gap-2 p-12 text-[14px]" style={{ color: '#697386' }}>
    <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
    Chargement...
  </div>
);

// Reusable error state
export const AdminErrorState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex items-center justify-center gap-2 p-12 text-[14px]" style={{ color: '#df1b41' }}>
    <span>⚠</span>
    {message ?? 'Une erreur est survenue lors du chargement des données.'}
  </div>
);

// Reusable table row count footer
export const AdminTableFooter: React.FC<{ count: number }> = ({ count }) => (
  <div className="px-6 py-3 text-[13px] border-t border-[#e3e8ef]" style={{ color: '#697386' }}>
    {count} élément{count !== 1 ? 's' : ''}
  </div>
);

// Reusable tier badge
export const TierBadge: React.FC<{ tier: string; badge: { label: string; color: string; bg: string } }> = ({ badge }) => (
  <span
    className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
    style={{ color: badge.color, backgroundColor: badge.bg }}
  >
    {badge.label}
  </span>
);

// Confirmation modal to replace window.confirm()
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, title, message, confirmLabel = 'Confirmer', danger = false, onConfirm, onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div
        className="bg-white rounded-[12px] p-6 w-[400px] max-w-[90vw]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      >
        <h3 className="text-[16px] font-semibold mb-2" style={{ color: '#1a1f36' }}>{title}</h3>
        <p className="text-[14px] mb-6" style={{ color: '#697386' }}>{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[14px] font-medium border border-[#e3e8ef] rounded-[6px] hover:bg-[#f7fafc] transition-colors"
            style={{ color: '#3c4257' }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-[14px] font-medium rounded-[6px] transition-colors text-white"
            style={{ backgroundColor: danger ? '#df1b41' : '#635bff' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = danger ? '#c0152f' : '#5850ec'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = danger ? '#df1b41' : '#635bff'; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
