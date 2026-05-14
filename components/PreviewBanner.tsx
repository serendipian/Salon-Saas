import { Eye, X } from 'lucide-react';
import type React from 'react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../lib/auth.types';

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

/**
 * Sticky banner shown whenever an owner has entered role-preview mode.
 * Rendered globally in Layout so the exit button stays reachable even if
 * the previewed role lacks access to the page the owner was on.
 */
export const PreviewBanner: React.FC = () => {
  const { previewRole, setPreviewRole } = useAuth();
  if (!previewRole) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye size={14} className="shrink-0" />
        <span className="text-sm font-medium truncate">
          Aperçu en tant que <strong>{ROLE_LABELS[previewRole]}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={() => setPreviewRole(null)}
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-900 hover:text-amber-950 bg-white hover:bg-amber-100 border border-amber-200 rounded-md transition-colors shrink-0"
      >
        <X size={12} />
        Quitter l'aperçu
      </button>
    </div>
  );
};
