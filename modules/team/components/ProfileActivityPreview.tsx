import React from 'react';
import { Activity, Clock, Loader2 } from 'lucide-react';
import { useStaffActivity } from '../hooks/useStaffActivity';

interface ProfileActivityPreviewProps {
  staffId: string;
  onSwitchTab?: (tab: string) => void;
}

export const ProfileActivityPreview: React.FC<ProfileActivityPreviewProps> = ({ staffId, onSwitchTab }) => {
  const { events: recentEvents, isLoading } = useStaffActivity(staffId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-5">Activité récente</h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Chargement...
        </div>
      ) : recentEvents.length === 0 ? (
        <div className="flex items-center gap-3 text-slate-400">
          <Activity size={20} />
          <span className="text-sm">Aucune activité récente.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {recentEvents.slice(0, 10).map((event, i) => (
            <div key={`${event.eventType}-${event.eventDate}-${i}`} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5">
                <Clock size={14} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900">{event.description}</p>
                {event.clientName && (
                  <p className="text-slate-500 text-xs mt-0.5">Client : {event.clientName}</p>
                )}
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {new Date(event.eventDate).toLocaleDateString('fr-FR')}
              </span>
            </div>
          ))}
          {onSwitchTab && (
            <button
              type="button"
              onClick={() => onSwitchTab('activite')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              Voir toute l'activité →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
