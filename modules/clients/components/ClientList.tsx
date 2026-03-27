
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  Filter,
  Eye,
  Edit,
  Calendar
} from 'lucide-react';
import { Client } from '../../../types';
import { formatPrice } from '../../../lib/format';

interface ClientListProps {
  clients: Client[];
  onAdd: () => void;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onSchedule: (id: string) => void;
}

export const ClientList: React.FC<ClientListProps> = ({ 
  clients, 
  onAdd, 
  onViewDetails, 
  onEdit, 
  onSchedule 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients.filter(c => 
    c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <button 
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau Client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher par nom, téléphone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>
          <button className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-sm shadow-sm">
            <Filter size={16} />
            Filtres
          </button>
        </div>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Téléphone</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Première Visite</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dernière Visite</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Visites</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dépensé</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Panier Moyen</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client) => {
                const initials = `${client.firstName[0]}${client.lastName[0]}`;
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
                          <div className="font-semibold text-slate-900 text-sm">{client.firstName} {client.lastName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {client.status === 'VIP' && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-bold">VIP</span>}
                      {client.status === 'ACTIF' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium">Actif</span>}
                      {client.status === 'INACTIF' && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-xs font-medium">Inactif</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} />
                        {client.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {client.lastVisitDate ? new Date(client.lastVisitDate).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {client.totalVisits}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="text-slate-900 font-medium text-sm">{formatPrice(client.totalSpent)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="text-slate-600 font-medium text-sm">{formatPrice(avgBasket)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => onViewDetails(client.id)} 
                          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors" 
                          title="Voir"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => onEdit(client.id)} 
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                          title="Modifier"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => onSchedule(client.id)} 
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" 
                          title="Prendre RDV"
                        >
                          <Calendar size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
