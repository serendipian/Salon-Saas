import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, ShoppingBag, Loader2 } from 'lucide-react';
import { useStaffActivity } from '../hooks/useStaffActivity';
import { StaffActivityEvent } from '../../../types';

interface StaffActivityTabProps {
  staffId: string;
}

const EVENT_CONFIG: Record<StaffActivityEvent['eventType'], {
  icon: React.FC<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  appointment_completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  appointment_cancelled: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  appointment_no_show: {
    icon: AlertCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  sale: {
    icon: ShoppingBag,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
};

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export const StaffActivityTab: React.FC<StaffActivityTabProps> = ({ staffId }) => {
  const { events, isLoading, loadMore, hasMore, isLoadingMore } = useStaffActivity(staffId);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center gap-2 text-slate-400 py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Chargement de l'activité...</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">Aucune activité</p>
          <p className="text-xs text-slate-400 mt-1">L'historique d'activité apparaîtra ici</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Historique d'activité</h3>
      <div className="space-y-1">
        {events.map((event, idx) => {
          const config = EVENT_CONFIG[event.eventType];
          const Icon = config.icon;
          const isLast = idx === events.length - 1;
          return (
            <div key={`${event.eventDate}-${idx}`} className="flex gap-3 relative">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-[15px] top-9 bottom-0 w-px bg-slate-200" />
              )}
              {/* Icon */}
              <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center shrink-0 z-10`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <p className="text-sm text-slate-800">{event.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {event.clientName && (
                    <span className="text-xs text-slate-500">{event.clientName}</span>
                  )}
                  <span className="text-xs text-slate-400">{formatRelativeDate(event.eventDate)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => loadMore()}
          disabled={isLoadingMore}
          className="mt-4 w-full py-2 text-sm text-pink-600 hover:text-pink-700 font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {isLoadingMore ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement...
            </span>
          ) : (
            'Charger plus'
          )}
        </button>
      )}
    </div>
  );
};
