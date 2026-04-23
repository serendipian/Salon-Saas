import { Loader2, Users } from 'lucide-react';
import type React from 'react';
import { formatName, formatPrice } from '../../../lib/format';
import { useStaffClients } from '../hooks/useStaffClients';

interface ProfileClientPortfolioProps {
  staffId: string;
}

export const ProfileClientPortfolio: React.FC<ProfileClientPortfolioProps> = ({ staffId }) => {
  const { clients, isLoading } = useStaffClients(staffId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Portfolio clients
          </h3>
          {clients.length > 0 && (
            <span className="text-xs text-slate-400">
              {clients.length} client{clients.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-8">
          <Loader2 size={16} className="animate-spin" />
          Chargement...
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Users size={18} />
          </div>
          <span className="text-sm">Aucun client associé</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-2.5 font-medium text-xs text-slate-500 uppercase tracking-wide">
                  Client
                </th>
                <th className="px-5 py-2.5 font-medium text-xs text-slate-500 uppercase tracking-wide text-center">
                  Visites
                </th>
                <th className="px-5 py-2.5 font-medium text-xs text-slate-500 uppercase tracking-wide text-right">
                  Revenus
                </th>
                <th className="px-5 py-2.5 font-medium text-xs text-slate-500 uppercase tracking-wide text-right hidden sm:table-cell">
                  Dernière visite
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.clientId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {client.clientFirstName?.[0]}
                        {client.clientLastName?.[0]}
                      </div>
                      <span className="text-slate-900 font-medium">
                        {formatName(client.clientFirstName)} {formatName(client.clientLastName)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center text-slate-600">{client.visitCount}</td>
                  <td className="px-5 py-3 text-right text-slate-900 font-medium">
                    {formatPrice(client.totalRevenue)}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500 hidden sm:table-cell">
                    {client.lastVisit
                      ? new Date(client.lastVisit).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
