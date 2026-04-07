import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, UserPlus, Check } from 'lucide-react';
import { Client } from '../../../types';
import { PhoneInput } from '../../../components/PhoneInput';

interface MobileClientSearchProps {
  clients: Client[];
  onSelectClient: (clientId: string) => void;
  onNewClient: (data: { firstName: string; lastName: string; phone: string }) => void;
  onClose: () => void;
}

export const MobileClientSearch: React.FC<MobileClientSearchProps> = ({
  clients,
  onSelectClient,
  onNewClient,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      searchRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients.slice(0, 30);
    const term = search.toLowerCase().trim();
    return clients
      .filter(
        (c) =>
          c.firstName.toLowerCase().includes(term) ||
          c.lastName.toLowerCase().includes(term) ||
          (c.phone && c.phone.toLowerCase().includes(term))
      )
      .slice(0, 30);
  }, [clients, search]);

  const handleSelect = (id: string) => {
    onSelectClient(id);
    onClose();
  };

  const handleCreate = () => {
    if (!firstName.trim()) return;
    onNewClient({ firstName: firstName.trim(), lastName: lastName.trim(), phone });
    onClose();
  };

  if (isCreating) {
    return (
      <div className="flex flex-col gap-4 p-1">
        {/* Header */}
        <div className="flex items-center gap-3 pb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <UserPlus size={18} className="text-blue-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Nouveau client</h3>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              placeholder="Prénom"
              className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>
          <PhoneInput
            label="Téléphone"
            value={phone}
            onChange={setPhone}
            required
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="flex-1 min-h-[48px] rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!firstName.trim()}
            className="flex-1 min-h-[48px] rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ajouter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      {/* Search input */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:bg-white transition-all"
        />
      </div>

      {/* Client list */}
      <div className="flex flex-col max-h-[50vh] overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelect(client.id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl min-h-[52px] hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold shrink-0">
                {client.firstName.charAt(0)}
                {client.lastName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {client.firstName} {client.lastName}
                </div>
                {client.phone && (
                  <div className="text-xs text-slate-400 truncate">{client.phone}</div>
                )}
              </div>
            </button>
          ))
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">
            Aucun client trouvé
          </div>
        )}
      </div>

      {/* New client button */}
      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors mt-1"
      >
        <UserPlus size={18} />
        Nouveau client
      </button>
    </div>
  );
};
