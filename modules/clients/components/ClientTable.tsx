import {
  Calendar,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Edit,
  Eye,
  Phone,
  Trash2,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { formatName, formatPrice } from '../../../lib/format';
import type { Client } from '../../../types';

interface ClientTableProps {
  clients: Client[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onSchedule: (id: string) => void;
  onDelete?: (id: string) => void;
}

type SortKey =
  | 'name'
  | 'firstVisit'
  | 'lastVisit'
  | 'totalVisits'
  | 'totalSpent'
  | 'avgBasket'
  | 'createdAt';

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const getSortValue = (client: Client, key: SortKey): number | string | null => {
  switch (key) {
    case 'name':
      return `${client.lastName ?? ''} ${client.firstName ?? ''}`.trim().toLowerCase();
    case 'firstVisit':
      return client.firstVisitDate ? new Date(client.firstVisitDate).getTime() : null;
    case 'lastVisit':
      return client.lastVisitDate ? new Date(client.lastVisitDate).getTime() : null;
    case 'totalVisits':
      return client.totalVisits;
    case 'totalSpent':
      return client.totalSpent;
    case 'avgBasket':
      return client.totalVisits > 0 ? client.totalSpent / client.totalVisits : null;
    case 'createdAt':
      return new Date(client.createdAt).getTime();
  }
};

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  onViewDetails,
  onEdit,
  onSchedule,
  onDelete,
}) => {
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' });

  const sortedClients = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...clients].sort((a, b) => {
      const va = getSortValue(a, sort.key);
      const vb = getSortValue(b, sort.key);
      // Nulls always last, regardless of direction
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
  }, [clients, sort]);

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const SortableHeader: React.FC<{
    label: string;
    sortKey: SortKey;
    className?: string;
  }> = ({ label, sortKey, className = '' }) => {
    const isActive = sort.key === sortKey;
    const Icon = !isActive ? ChevronsUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
    return (
      <th
        scope="col"
        aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${className}`}
      >
        <button
          type="button"
          onClick={() => handleSort(sortKey)}
          className="flex items-center gap-1 uppercase tracking-wider hover:text-slate-900 transition-colors"
        >
          {label}
          <Icon size={12} className={isActive ? 'text-slate-700' : 'text-slate-400'} />
        </button>
      </th>
    );
  };

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
            <SortableHeader label="Client" sortKey="name" />
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
              Téléphone
            </th>
            <SortableHeader
              label="Première Visite"
              sortKey="firstVisit"
              className="hidden lg:table-cell"
            />
            <SortableHeader
              label="Dernière Visite"
              sortKey="lastVisit"
              className="hidden lg:table-cell"
            />
            <SortableHeader label="Total Visites" sortKey="totalVisits" />
            <SortableHeader label="Total Dépensé" sortKey="totalSpent" />
            <SortableHeader
              label="Panier Moyen"
              sortKey="avgBasket"
              className="hidden lg:table-cell"
            />
            <SortableHeader
              label="Date de Création"
              sortKey="createdAt"
              className="hidden lg:table-cell"
            />
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedClients.map((client) => {
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
                        {[formatName(client.firstName), formatName(client.lastName)]
                          .filter(Boolean)
                          .join(' ')}
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
                      aria-label={`Voir ${formatName(client.firstName)} ${formatName(client.lastName)}`}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => onEdit(client.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Modifier"
                      aria-label={`Modifier ${formatName(client.firstName)} ${formatName(client.lastName)}`}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => onSchedule(client.id)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Prendre RDV"
                      aria-label={`Prendre RDV pour ${formatName(client.firstName)} ${formatName(client.lastName)}`}
                    >
                      <Calendar size={16} />
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(client.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Supprimer"
                        aria-label={`Supprimer ${formatName(client.firstName)} ${formatName(client.lastName)}`}
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
