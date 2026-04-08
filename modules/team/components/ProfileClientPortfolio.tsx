import React from 'react';
import { Users, Loader2 } from 'lucide-react';
import { useStaffClients } from '../hooks/useStaffClients';
import { formatPrice } from '../../../lib/format';

interface ProfileClientPortfolioProps {
  staffId: string;
}

export const ProfileClientPortfolio: React.FC<ProfileClientPortfolioProps> = ({ staffId }) => {
  const { clients, isLoading } = useStaffClients(staffId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-5">Portfolio clients</h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Chargement...
        </div>
      ) : clients.length === 0 ? (
        <div className="flex items-center gap-3 text-slate-400">
          <Users size={20} />
          <span className="text-sm">Aucun client associé pour le moment.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="pb-2 font-medium text-slate-500">Client</th>
                <th className="pb-2 font-medium text-slate-500 text-center">Visites</th>
                <th className="pb-2 font-medium text-slate-500 text-right">Revenus</th>
                <th className="pb-2 font-medium text-slate-500 text-right hidden sm:table-cell">Dernière visite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map(client => (
                <tr key={client.clientId}>
                  <td className="py-2.5 text-slate-900 font-medium">
                    {client.clientFirstName} {client.clientLastName}
                  </td>
                  <td className="py-2.5 text-center text-slate-600">{client.visitCount}</td>
                  <td className="py-2.5 text-right text-slate-900 font-medium">
                    {formatPrice(client.totalRevenue)}
                  </td>
                  <td className="py-2.5 text-right text-slate-500 hidden sm:table-cell">
                    {client.lastVisit ? new Date(client.lastVisit).toLocaleDateString('fr-FR') : '—'}
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
