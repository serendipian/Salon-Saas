import React from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShoppingBag,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useStaffActivity } from '../hooks/useStaffActivity';
import type { StaffActivityEvent } from '../../../types';

interface ProfileActivityPreviewProps {
  staffId: string;
  onSwitchTab?: (tab: string) => void;
}

const EVENT_CONFIG: Record<
  StaffActivityEvent['eventType'],
  {
    icon: React.FC<{ className?: string; size?: number }>;
    color: string;
    bgColor: string;
  }
> = {
  appointment_completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  appointment_cancelled: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-50' },
  appointment_no_show: { icon: AlertCircle, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  sale: { icon: ShoppingBag, color: 'text-blue-600', bgColor: 'bg-blue-50' },
};

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export const ProfileActivityPreview: React.FC<ProfileActivityPreviewProps> = ({
  staffId,
  onSwitchTab,
}) => {
  const { events: recentEvents, isLoading } = useStaffActivity(staffId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Activité récente
        </h3>
        {onSwitchTab && recentEvents.length > 0 && (
          <button
            onClick={() => onSwitchTab('activite')}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Tout voir <ArrowRight size={12} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 size={16} className="animate-spin" />
          Chargement...
        </div>
      ) : recentEvents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Activity size={18} />
          </div>
          <span className="text-sm">Aucune activité récente</span>
        </div>
      ) : (
        <div className="p-5">
          <div className="space-y-1">
            {recentEvents.slice(0, 8).map((event, idx) => {
              const config = EVENT_CONFIG[event.eventType];
              const Icon = config.icon;
              const isLast = idx === Math.min(recentEvents.length, 8) - 1;
              return (
                <div
                  key={`${event.eventType}-${event.eventDate}-${idx}`}
                  className="flex gap-3 relative"
                >
                  {!isLast && (
                    <div className="absolute left-[15px] top-9 bottom-0 w-px bg-slate-100" />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center shrink-0 z-10`}
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <p className="text-sm text-slate-800 truncate">{event.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {event.clientName && (
                        <span className="text-xs text-slate-500">{event.clientName}</span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatRelativeDate(event.eventDate)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
