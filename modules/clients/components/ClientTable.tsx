import { Calendar, Edit, Eye, Phone, Trash2, Users } from 'lucide-react';
import type React from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { formatPrice } from '../../../lib/format';
import type { Client } from '../../../types';

interface ClientTableProps {
  clients: Client[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onSchedule: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const ClientTable: React.FC<ClientTableProps> = ({
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
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Client
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
              Téléphone
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
              Première Visite
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
              Dernière Visite
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Visites
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Dépensé
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
              Panier Moyen
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
              Date de Création
            </th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {clients.map((client) => {
            const initials =
              `${client.firstName?.[0] ?? ''}${client.lastName?.[0] ?? ''}`.toUpperCase();
            const avgBasket = client.totalVisits > 0 ? client.totalSpent / client.totalVisits : 0;

            return (
              <tr
                key={client.id}
                onClick={() => onViewDetails(client.id)}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {[client.firstName, client.lastName].filter(Boolean).join(' ')}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
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
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} />
                    {client.phone}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap hidden lg:table-cell">
                  {client.firstVisitDate
                    ? new Date(client.firstVisitDate).toLocaleDateString('fr-FR')
                    : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap hidden lg:table-cell">
                  {client.lastVisitDate
                    ? new Date(client.lastVisitDate).toLocaleDateString('fr-FR')
                    : '-'}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                  {client.totalVisits}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-slate-900 font-medium text-sm">
                    {formatPrice(client.totalSpent)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                  <span className="text-slate-600 font-medium text-sm">
                    {formatPrice(avgBasket)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap hidden lg:table-cell">
                  {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onViewDetails(client.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                      title="Voir"
                      aria-label={`Voir ${client.firstName} ${client.lastName}`}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => onEdit(client.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Modifier"
                      aria-label={`Modifier ${client.firstName} ${client.lastName}`}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => onSchedule(client.id)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Prendre RDV"
                      aria-label={`Prendre RDV pour ${client.firstName} ${client.lastName}`}
                    >
                      <Calendar size={16} />
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(client.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Supprimer"
                        aria-label={`Supprimer ${client.firstName} ${client.lastName}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
