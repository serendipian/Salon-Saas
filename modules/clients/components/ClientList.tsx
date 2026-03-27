
import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Client } from '../../../types';
import { useViewMode } from '../../../hooks/useViewMode';
import { ViewToggle } from '../../../components/ViewToggle';
import { ClientTable } from './ClientTable';
import { ClientCard } from './ClientCard';

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
  const { viewMode, setViewMode } = useViewMode('clients');

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
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* Content */}
        {viewMode === 'table' ? (
          <ClientTable
            clients={filteredClients}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onSchedule={onSchedule}
          />
        ) : (
          <ClientCard
            clients={filteredClients}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onSchedule={onSchedule}
          />
        )}
      </div>
    </div>
  );
};
