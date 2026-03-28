import React, { useState, useMemo } from 'react';
import type { Client } from '../../../types';

interface ClientFieldProps {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onClearClient: () => void;
  newClientData: { firstName: string; lastName: string; phone: string } | null;
  onNewClientChange: (data: { firstName: string; lastName: string; phone: string } | null) => void;
  error?: string;
}

export default function ClientField({
  clients,
  selectedClientId,
  onSelectClient,
  onClearClient,
  newClientData,
  onNewClientChange,
  error,
}: ClientFieldProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId],
  );

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const list = term
      ? clients.filter(
          (c) =>
            c.firstName.toLowerCase().includes(term) ||
            c.lastName.toLowerCase().includes(term) ||
            c.phone?.toLowerCase().includes(term),
        )
      : clients;
    return list.slice(0, 20);
  }, [clients, searchTerm]);

  // Show "Nouveau" inline form
  if (newClientData) {
    return (
      <div className="mb-4">
        <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Client *</div>
        <div className="bg-slate-50 border border-pink-400 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[11px] text-pink-600 font-semibold uppercase tracking-wider">Nouveau client</span>
            <button type="button" onClick={() => onNewClientChange(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Prénom *</div>
              <input
                type="text"
                value={newClientData.firstName}
                onChange={(e) => onNewClientChange({ ...newClientData, firstName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-2 text-sm text-slate-800 focus:border-pink-400 focus:outline-none min-h-[44px]"
                placeholder="Prénom"
                autoFocus
              />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">Nom</div>
              <input
                type="text"
                value={newClientData.lastName}
                onChange={(e) => onNewClientChange({ ...newClientData, lastName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-2 text-sm text-slate-800 focus:border-pink-400 focus:outline-none min-h-[44px]"
                placeholder="Optionnel"
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1">Téléphone *</div>
            <input
              type="tel"
              inputMode="tel"
              value={newClientData.phone}
              onChange={(e) => onNewClientChange({ ...newClientData, phone: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-2 text-sm text-slate-800 focus:border-pink-400 focus:outline-none min-h-[44px]"
              placeholder="+212 6 XX XX XX XX"
            />
          </div>
          <p className="text-slate-400 text-[10px] mt-2 italic">Le client sera automatiquement ajouté au CRM</p>
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    );
  }

  // Show selected client chip
  if (selectedClient) {
    const initials = `${selectedClient.firstName[0] ?? ''}${selectedClient.lastName[0] ?? ''}`.toUpperCase();
    return (
      <div className="mb-4">
        <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Client *</div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-pink-400 rounded-full flex items-center justify-center text-white text-xs font-semibold">{initials}</div>
            <div>
              <div className="text-slate-800 text-sm font-medium">{selectedClient.firstName} {selectedClient.lastName}</div>
              <div className="text-slate-400 text-[11px]">{selectedClient.phone ?? ''}</div>
            </div>
          </div>
          <button type="button" onClick={onClearClient} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
        </div>
      </div>
    );
  }

  // Default: search + "Nouveau" button
  return (
    <div className="mb-4">
      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Client *</div>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
            placeholder="Rechercher un client..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:border-pink-400 focus:outline-none min-h-[44px] pl-9"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          {isSearchOpen && filteredClients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onMouseDown={() => { onSelectClient(client.id); setSearchTerm(''); setIsSearchOpen(false); }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-sm"
                >
                  <div className="w-7 h-7 bg-pink-500/20 text-pink-400 rounded-full flex items-center justify-center text-[10px] font-semibold">
                    {client.firstName[0]}{client.lastName[0] ?? ''}
                  </div>
                  <div>
                    <div className="text-slate-800">{client.firstName} {client.lastName}</div>
                    <div className="text-slate-400 text-[11px]">{client.phone ?? ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onNewClientChange({ firstName: '', lastName: '', phone: '' })}
          className="bg-slate-50 border border-slate-300 text-slate-700 px-3.5 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 hover:border-slate-400 min-h-[44px]"
        >
          <span className="text-pink-600 font-bold">+</span> Nouveau
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
