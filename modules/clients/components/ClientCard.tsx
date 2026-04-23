import { Calendar, Edit, Eye, Mail, Phone, Trash2, Users } from 'lucide-react';
import type React from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { formatName, formatPrice } from '../../../lib/format';
import type { Client } from '../../../types';

interface ClientCardProps {
  clients: Client[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onSchedule: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  clients,
  onViewDetails,
  onEdit,
  onSchedule,
  onDelete,
}) => {
  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="Aucun client trouvé"
        description="Essayez de modifier vos critères de recherche."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {clients.map((client) => {
        const initials =
          `${client.firstName?.[0] ?? ''}${client.lastName?.[0] ?? ''}`.toUpperCase();

        return (
          <button
            key={client.id}
            type="button"
            onClick={() => onViewDetails(client.id)}
            aria-label={`Voir le profil de ${formatName(client.firstName)} ${formatName(client.lastName)}`}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            {/* Header: avatar + name + status */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200 shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 text-sm truncate">
                  {[formatName(client.firstName), formatName(client.lastName)]
                    .filter(Boolean)
                    .join(' ')}
                </div>
                <div className="mt-0.5">
                  {client.status === 'VIP' && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold">
                      VIP
                    </span>
                  )}
                  {client.status === 'ACTIF' && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium">
                      Actif
                    </span>
                  )}
                  {client.status === 'INACTIF' && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-xs font-medium">
                      Inactif
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone size={14} className="shrink-0" />
                <span className="truncate">{client.phone}</span>
              </div>
              {client.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm mb-3">
              <div>
                <div className="text-slate-500 text-xs">Visites</div>
                <div className="font-medium text-slate-900">{client.totalVisits}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Total</div>
                <div className="font-medium text-slate-900">{formatPrice(client.totalSpent)}</div>
              </div>
            </div>

            {/* Actions */}
            <div
              className="flex items-center gap-2 pt-3 border-t border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onViewDetails(client.id)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                title="Voir"
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                onClick={() => onEdit(client.id)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Modifier"
              >
                <Edit size={16} />
              </button>
              <button
                type="button"
                onClick={() => onSchedule(client.id)}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                title="Prendre RDV"
              >
                <Calendar size={16} />
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(client.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
