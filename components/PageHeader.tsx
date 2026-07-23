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
  /** Accessible label for the back button (also its tooltip). */
  backLabel?: string;
}

/**
 * Renders a page's title + actions into the shared title bar in Layout.
 *
 * Mount exactly one of these per page. It portals its content into the bar
 * (so buttons stay wired to the page's own state) and toggles the bar's
 * visibility while mounted. Renders nothing inline.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  meta,
  actions,
  backTo,
  backLabel = 'Retour',
}) => {
  const { slot, register, unregister } = usePageHeaderSlot();
  const navigate = useNavigate();

  useEffect(() => {
    register();
    return () => unregister();
  }, [register, unregister]);

  if (!slot) return null;

  return createPortal(
    <div className="flex items-center justify-between gap-3 sm:gap-4 px-4 md:px-6 h-full min-h-[60px]">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {backTo && (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            aria-label={backLabel}
            title={backLabel}
            className="-ml-1 shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              {title}
            </h1>
            {meta}
          </div>
          {subtitle && <p className="text-[13px] text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>,
    slot,
  );
};
