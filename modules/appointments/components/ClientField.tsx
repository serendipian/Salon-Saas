import { Search, UserCheck, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PhoneInput } from '../../../components/PhoneInput';
import type { Client } from '../../../types';

interface ClientFieldProps {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onClearClient: () => void;
  newClientData: { firstName: string; lastName: string; phone: string } | null;
  onNewClientChange: (data: { firstName: string; lastName: string; phone: string } | null) => void;
  error?: string;
  showExistingSearch: boolean;
  onShowExistingSearchChange: (show: boolean) => void;
}

export default function ClientField({
  clients,
  selectedClientId,
  onSelectClient,
  onClearClient,
  newClientData,
  onNewClientChange,
  error,
  showExistingSearch,
  onShowExistingSearchChange,
}: ClientFieldProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId],
  );

  // Auto-initialize new client data when in default mode
  useEffect(() => {
    if (!selectedClientId && !newClientData && !showExistingSearch) {
      onNewClientChange({ firstName: '', lastName: '', phone: '' });
    }
  }, [selectedClientId, showExistingSearch, onNewClientChange, newClientData]);

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

  // Prefix-match clients by phone number as user types
  const phoneMatches = useMemo(() => {
    const phone = (newClientData?.phone ?? '').replace(/[\s+]/g, '');
    if (phone.length < 4) return [];
    return clients
      .filter((c) => {
        const clientPhone = (c.phone ?? '').replace(/[\s+]/g, '');
        return clientPhone?.startsWith(phone);
      })
      .slice(0, 5);
  }, [clients, newClientData?.phone]);

  // Show selected client chip
  if (selectedClient) {
    const initials =
      `${selectedClient.firstName?.[0] ?? ''}${selectedClient.lastName?.[0] ?? ''}`.toUpperCase();
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
            {initials}
          </div>
          <div>
            <div className="text-slate-800 text-sm font-medium">
              {[selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(' ')}
            </div>
            <div className="text-slate-400 text-xs">{selectedClient.phone ?? ''}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClearClient}
          className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
        >
          <X size={14} className="text-slate-400" />
        </button>
      </div>
    );
  }

  // Existing client search mode
  if (showExistingSearch) {
    return (
      <div>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
              placeholder="Rechercher un client..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none min-h-[44px] pl-10 transition-all"
            />
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            {isSearchOpen && filteredClients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-black/5 z-10 max-h-64 overflow-y-auto">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onMouseDown={() => {
                      onSelectClient(client.id);
                      setSearchTerm('');
                      setIsSearchOpen(false);
                      onShowExistingSearchChange(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 flex items-center gap-3 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[11px] font-semibold">
                      {client.firstName?.[0] ?? ''}
                      {client.lastName?.[0] ?? ''}
                    </div>
                    <div>
                      <div className="text-slate-800 font-medium">
                        {[client.firstName, client.lastName].filter(Boolean).join(' ')}
                      </div>
                      <div className="text-slate-400 text-xs">{client.phone ?? ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onShowExistingSearchChange(false);
              setSearchTerm('');
              onNewClientChange({ firstName: '', lastName: '', phone: '' });
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 min-h-[44px] transition-colors shadow-sm"
          >
            <UserPlus size={14} /> Nouveau
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
      </div>
    );
  }

  // Default: new client form (phone + name on same row, with prefix matching)
  const clientData = newClientData ?? { firstName: '', lastName: '', phone: '' };

  const handleFieldChange = (updates: Partial<typeof clientData>) => {
    onNewClientChange({ ...clientData, ...updates });
  };

  return (
    <div>
      <div className="space-y-3">
        {/* Row 1: Phone (full width) */}
        <div className="relative">
          <PhoneInput
            label="Téléphone"
            required
            value={clientData.phone}
            onChange={(phone) => {
              handleFieldChange({ phone });
              setIsPhoneDropdownOpen(true);
            }}
          />

          {/* Phone prefix match dropdown */}
          {isPhoneDropdownOpen && phoneMatches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-black/5 z-10 max-h-52 overflow-y-auto">
              <div className="px-3 py-2 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <UserCheck size={12} />
                  Clients existants
                </span>
              </div>
              {phoneMatches.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onMouseDown={() => {
                    onSelectClient(client.id);
                    onNewClientChange(null);
                    setIsPhoneDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 flex items-center gap-3 text-sm transition-colors last:rounded-b-xl"
                >
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[11px] font-semibold">
                    {client.firstName?.[0] ?? ''}
                    {client.lastName?.[0] ?? ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-800 font-medium truncate">
                      {[client.firstName, client.lastName].filter(Boolean).join(' ')}
                    </div>
                    <div className="text-slate-400 text-xs">{client.phone ?? ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: First name + Last name (2 columns) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom *</label>
            <input
              type="text"
              value={clientData.firstName}
              onChange={(e) => handleFieldChange({ firstName: e.target.value })}
              onFocus={() => setIsPhoneDropdownOpen(false)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none min-h-[44px] transition-all"
              placeholder="Prénom"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom</label>
            <input
              type="text"
              value={clientData.lastName}
              onChange={(e) => handleFieldChange({ lastName: e.target.value })}
              onFocus={() => setIsPhoneDropdownOpen(false)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none min-h-[44px] transition-all"
              placeholder="Optionnel"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
    </div>
  );
}
