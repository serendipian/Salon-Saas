import { BellOff, ChevronRight } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface NotificationPanelProps {
  onClose: () => void;
  /** Positioning classes — the rail anchors it to the side, the mobile bar below. */
  className?: string;
}

/**
 * Notification dropdown.
 *
 * There is no notifications table yet, so this renders the empty state and a
 * shortcut to the reminder settings. When a feed lands, the list replaces the
 * empty state and the trigger gains an unread badge — the shell around it
 * (trigger, outside-click, escape) already works.
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose, className = '' }) => {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const el = panelRef.current;
      // The trigger lives outside the panel; it toggles itself, so ignore it here.
      if (el && !el.contains(e.target as Node) && !(e.target as Element)?.closest?.('[data-notification-trigger]')) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className={`w-[280px] bg-white rounded-xl border border-slate-200/70 shadow-[0_20px_48px_-16px_rgba(15,23,42,0.22),0_8px_16px_-8px_rgba(15,23,42,0.08)] overflow-hidden ${className}`}
      style={{ zIndex: 'var(--z-drawer-panel)' }}
    >
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">Notifications</p>
      </div>

      <div className="px-4 py-8 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3">
          <BellOff size={18} className="text-slate-300" strokeWidth={1.75} />
        </div>
        <p className="text-[13px] font-medium text-slate-700">Aucune notification</p>
        <p className="text-xs text-slate-400 mt-0.5">Vous êtes à jour.</p>
      </div>

      <button
        type="button"
        onClick={() => {
          navigate('/settings/notifications');
          onClose();
        }}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        Gérer les notifications
        <ChevronRight size={14} className="text-slate-300 shrink-0" />
      </button>
    </div>
  );
};
