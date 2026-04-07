import React, { useState, useMemo } from 'react';
import type { Client } from '../../../types';
import { PhoneInput } from '../../../components/PhoneInput';
import { Search, UserPlus, X, UserCheck } from 'lucide-react';

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

  // Find existing clients matching the phone number being typed
  const phoneMatches = useMemo(() => {
    if (!newClientData?.phone || newClientData.phone.length < 6) return [];
    const phone = newClientData.phone.replace(/\s/g, '');
    return clients.filter((c) => {
      const clientPhone = c.phone?.replace(/\s/g, '') ?? '';
      return clientPhone && clientPhone === phone;
    });
  }, [clients, newClientData?.phone]);

  // Show "Nouveau" inline form
  if (newClientData) {
    return (
      <div className="mb-4">
        <div className="text-xs font-medium text-slate-500 mb-2">Client *</div>
        <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <UserPlus size={12} className="text-blue-600" />
              </div>
              <span className="text-xs text-blue-700 font-semibold">Nouveau client</span>
            </div>
            <button type="button" onClick={() => onNewClientChange(null)} className="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <PhoneInput
              label="Téléphone *"
              required
              value={newClientData.phone}
              onChange={(phone) => onNewClientChange({ ...newClientData, phone })}
            />
            <div>
              <div className="text-[11px] text-slate-500 mb-1 font-medium">Prénom *</div>
              <input
                type="text"
                value={newClientData.firstName}
                onChange={(e) => onNewClientChange({ ...newClientData, firstName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none min-h-[44px] transition-all"
                placeholder="Prénom"
              />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 mb-1 font-medium">Nom</div>
              <input
                type="text"
                value={newClientData.lastName}
                onChange={(e) => onNewClientChange({ ...newClientData, lastName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none min-h-[44px] transition-all"
                placeholder="Optionnel"
              />
            </div>
          </div>

          {/* Phone match suggestion */}
          {phoneMatches.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1.5">
                <UserCheck size={13} />
                Client existant avec ce numéro
              </div>
              <div className="flex flex-col gap-1.5">
                {phoneMatches.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      onSelectClient(client.id);
                      onNewClientChange(null);
                    }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    <div className="w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {client.firstName?.[0] ?? ''}{client.lastName?.[0] ?? ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {[client.firstName, client.lastName].filter(Boolean).join(' ')}
                      </div>
                      <div className="text-xs text-slate-400">{client.phone}</div>
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">Sélectionner</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-amber-600 mt-2">Vous pouvez aussi continuer pour créer un nouveau client</p>
            </div>
          )}

          <p className="text-slate-400 text-[10px] mt-3">Ajouté automatiquement au CRM</p>
        </div>
        {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
      </div>
    );
  }

  // Show selected client chip
  if (selectedClient) {
    const initials = `${selectedClient.firstName?.[0] ?? ''}${selectedClient.lastName?.[0] ?? ''}`.toUpperCase();
    return (
      <div className="mb-4">
        <div className="text-xs font-medium text-slate-500 mb-2">Client *</div>
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">{initials}</div>
            <div>
              <div className="text-slate-800 text-sm font-medium">{[selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(' ')}</div>
              <div className="text-slate-400 text-xs">{selectedClient.phone ?? ''}</div>
            </div>
          </div>
          <button type="button" onClick={onClearClient} className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <X size={14} className="text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  // Default: search + "Nouveau" button
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-slate-500 mb-2">Client *</div>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
            placeholder="Rechercher un client..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none min-h-[44px] pl-10 transition-all"
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          {isSearchOpen && filteredClients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-black/5 z-10 max-h-64 overflow-y-auto">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onMouseDown={() => { onSelectClient(client.id); setSearchTerm(''); setIsSearchOpen(false); }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 flex items-center gap-3 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[11px] font-semibold">
                    {client.firstName?.[0] ?? ''}{client.lastName?.[0] ?? ''}
                  </div>
                  <div>
                    <div className="text-slate-800 font-medium">{[client.firstName, client.lastName].filter(Boolean).join(' ')}</div>
                    <div className="text-slate-400 text-xs">{client.phone ?? ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onNewClientChange({ firstName: '', lastName: '', phone: '' })}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 min-h-[44px] transition-colors shadow-sm"
        >
          <UserPlus size={14} /> Nouveau
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
    </div>
  );
}
