import { ChevronLeft } from 'lucide-react';
import type React from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePageHeaderSlot } from '../context/PageHeaderContext';

interface PageHeaderProps {
  /** Page title (usually a string, but any node is allowed). */
  title: React.ReactNode;
  /** Optional secondary line under the title. */
  subtitle?: React.ReactNode;
  /** Small node shown next to the title (e.g. FreshnessIndicator, a status pill). */
  meta?: React.ReactNode;
  /** Primary/secondary action buttons rendered on the right. */
  actions?: React.ReactNode;
  /** Route to navigate to from the back chevron. Omit for no back button. */
  backTo?: string;
  /** Callback-based back (for inline views that use onCancel, not routing). Takes precedence over backTo. */
  onBack?: () => void;
  /** Accessible label for the back button (also its tooltip). */
  backLabel?: string;
}

/**
 * Renders a page's title + actions into the app's single top bar in Layout.
 *
 * Mount exactly one of these per page. It portals its content into the bar
 * (so buttons stay wired to the page's own state) and registers itself while
 * mounted. Renders nothing inline.
 *
 * The bar is shared with the global controls (search, notifications, account),
 * so this fills a flex slot rather than a full-width strip — keep `actions`
 * compact and collapse long button labels below `sm`.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  meta,
  actions,
  backTo,
  onBack,
  backLabel = 'Retour',
}) => {
  const { slot, actionsSlot, register, unregister } = usePageHeaderSlot();
  const navigate = useNavigate();

  useEffect(() => {
    register();
    return () => unregister();
  }, [register, unregister]);

  if (!slot) return null;

  const hasBack = Boolean(onBack || backTo);
  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
  };

  return (
    <>
      {createPortal(
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 h-full">
          {hasBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label={backLabel}
              title={backLabel}
              className="-ml-1.5 shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
          )}
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {title}
              </h1>
              {meta}
            </div>
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
        </div>,
        slot,
      )}
      {actions && actionsSlot && createPortal(actions, actionsSlot)}
    </>
  );
};
