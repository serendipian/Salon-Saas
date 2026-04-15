import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import type React from 'react';
import { createPortal } from 'react-dom';
import type { ToastType } from '../context/ToastContext';
import { useToast, useToastState } from '../context/ToastContext';

const TOAST_STYLES: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: { border: 'border-l-emerald-500', icon: 'text-emerald-500', bg: 'bg-white' },
  error: { border: 'border-l-red-500', icon: 'text-red-500', bg: 'bg-white' },
  warning: { border: 'border-l-amber-500', icon: 'text-amber-500', bg: 'bg-white' },
  info: { border: 'border-l-blue-500', icon: 'text-blue-500', bg: 'bg-white' },
};

const TOAST_ICONS: Record<ToastType, React.FC<{ size: number; className: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToastState();
  const { removeToast } = useToast();

  const portalTarget = document.getElementById('toast-root');
  if (!portalTarget) return null;

  const visible = toasts.slice(0, 3);

  return createPortal(
    <div
      className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {visible.map((toast) => {
        const styles = TOAST_STYLES[toast.type];
        const Icon = TOAST_ICONS[toast.type];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border border-slate-200 border-l-4 ${styles.border} ${styles.bg} min-w-[320px] max-w-[420px] animate-in slide-in-from-right duration-300`}
            role="alert"
          >
            <Icon size={18} className={`${styles.icon} shrink-0 mt-0.5`} />
            <p className="text-sm text-slate-700 flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    portalTarget,
  );
};
