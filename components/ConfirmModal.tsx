import React from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

export type ConfirmTone = 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  /** Body message — can be a string or React node for richer content. */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const TONE_CONFIG: Record<ConfirmTone, {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  bannerBg: string;
  bannerBorder: string;
  bannerText: string;
  confirmBg: string;
  confirmHover: string;
}> = {
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    bannerBg: 'bg-red-50',
    bannerBorder: 'border-red-100',
    bannerText: 'text-red-700',
    confirmBg: 'bg-red-600',
    confirmHover: 'hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    bannerBg: 'bg-amber-50',
    bannerBorder: 'border-amber-100',
    bannerText: 'text-amber-700',
    confirmBg: 'bg-amber-600',
    confirmHover: 'hover:bg-amber-700',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    bannerBg: 'bg-blue-50',
    bannerBorder: 'border-blue-100',
    bannerText: 'text-blue-700',
    confirmBg: 'bg-slate-900',
    confirmHover: 'hover:bg-slate-800',
  },
};

/**
 * Accessible confirmation dialog with danger / warning / info tones.
 * Use in place of `window.confirm()` for destructive or mutating actions.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  const cfg = TONE_CONFIG[tone];
  const Icon = cfg.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} dismissible={!isLoading}>
      <div className="px-6 pb-6">
        <div className={`flex items-start gap-3 p-3 ${cfg.bannerBg} border ${cfg.bannerBorder} rounded-lg mb-5`}>
          <Icon className={`w-5 h-5 ${cfg.iconColor} shrink-0 mt-0.5`} />
          <div className={`text-sm ${cfg.bannerText}`}>{message}</div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white ${cfg.confirmBg} ${cfg.confirmHover} rounded-lg disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 transition-colors`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
