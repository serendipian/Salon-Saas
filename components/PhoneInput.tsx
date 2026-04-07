import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  name: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: 'MA', dial: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'BE', dial: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', dial: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'NL', dial: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: 'DZ', dial: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: 'TN', dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'LY', dial: '+218', flag: '🇱🇾', name: 'Libye' },
  { code: 'MR', dial: '+222', flag: '🇲🇷', name: 'Mauritanie' },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'CD', dial: '+243', flag: '🇨🇩', name: 'RD Congo' },
  { code: 'GA', dial: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'Émirats arabes unis' },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Arabie saoudite' },
  { code: 'QA', dial: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: 'KW', dial: '+965', flag: '🇰🇼', name: 'Koweït' },
  { code: 'TR', dial: '+90', flag: '🇹🇷', name: 'Turquie' },
  { code: 'EG', dial: '+20', flag: '🇪🇬', name: 'Égypte' },
  { code: 'JO', dial: '+962', flag: '🇯🇴', name: 'Jordanie' },
  { code: 'LB', dial: '+961', flag: '🇱🇧', name: 'Liban' },
];

const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // Morocco

// Sort dial codes by length descending so longer prefixes match first
const SORTED_BY_DIAL_LENGTH = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);

function splitPhone(value: string): { country: CountryCode; local: string } {
  for (const c of SORTED_BY_DIAL_LENGTH) {
    if (value.startsWith(c.dial)) {
      return { country: c, local: value.slice(c.dial.length) };
    }
  }
  return { country: DEFAULT_COUNTRY, local: value };
}

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (fullValue: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label,
  value,
  onChange,
  required,
  error,
  className,
  placeholder = '6 XX XX XX XX',
}) => {
  const { country, local } = splitPhone(value);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search) return COUNTRY_CODES;
    const term = search.toLowerCase();
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.dial.includes(term) ||
        c.code.toLowerCase().includes(term),
    );
  }, [search]);

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9\s]/g, '');
    onChange(raw ? `${country.dial}${raw}` : '');
  };

  const handleSelectCountry = (c: CountryCode) => {
    setIsOpen(false);
    setSearch('');
    onChange(local ? `${c.dial}${local}` : '');
  };

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex">
        {/* Country code selector */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg px-2.5 text-sm font-medium text-slate-700 min-h-[44px] hover:bg-slate-200 transition-colors select-none shrink-0"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="text-xs font-semibold">{country.dial}</span>
          <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9\s]*"
          value={local}
          onChange={handleLocalChange}
          required={required}
          placeholder={placeholder}
          className={`
            w-full bg-white border rounded-r-lg rounded-l-none text-sm shadow-sm transition-all min-h-[44px]
            focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
            pl-3 pr-3 py-2.5
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
            disabled:bg-slate-50 disabled:text-slate-500
          `}
        />

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl ring-1 ring-black/5 max-h-72 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200" style={{ zIndex: 'var(--z-drawer-panel, 50)' }}>
            <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un pays..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:bg-white transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-1.5">
              {filtered.length > 0 ? (
                filtered.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onMouseDown={() => handleSelectCountry(c)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors text-sm min-h-[40px] ${
                      c.code === country.code
                        ? 'bg-slate-100 font-medium text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{c.dial}</span>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-slate-400">Aucun pays trouvé</div>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
