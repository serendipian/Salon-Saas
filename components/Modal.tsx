import { X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible title — also shown as the modal header unless `hideHeader` is set. */
  title: string;
  /** Hide the built-in header (useful when children render their own title). */
  hideHeader?: boolean;
  /** Max width class (default `max-w-md`). */
  size?: 'sm' | 'md' | 'lg';
  /** Disable closing via backdrop click / Escape key (e.g., during a mutation). */
  dismissible?: boolean;
  children: React.ReactNode;
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/**
 * Accessible modal wrapper with focus trap, Escape-to-close, backdrop click,
 * scroll lock, and `inert` on the main content. Based on the same a11y pattern
 * as MobileDrawer.
 *
 * Children render inside the panel; callers supply their own body and footer.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  hideHeader = false,
  size = 'md',
  dismissible = true,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + Escape key + focus restoration
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element (or the panel itself) on open
    const panel = panelRef.current;
    if (panel) {
      const firstFocusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? panel).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose, dismissible]);

  // Set inert on main content while open (prevents focus from escaping)
  useEffect(() => {
    if (!isOpen) return;
    const main = document.getElementById('main-content');
    if (main) {
      main.setAttribute('inert', '');
      return () => main.removeAttribute('inert');
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => dismissible && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white rounded-xl shadow-xl w-full ${SIZE_MAP[size]} focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <div className="flex items-center justify-between px-6 pt-6 pb-3">
            <h3 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        {hideHeader && (
          <span id={titleId} className="sr-only">
            {title}
          </span>
        )}
        {children}
      </div>
    </div>
  );
};
