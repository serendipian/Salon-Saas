import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon, ChevronDown, Check, Search } from 'lucide-react';
import { useMediaQuery } from '../context/MediaQueryContext';
import { MobileSelect } from './MobileSelect';

// --- Types ---
interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  prefix?: string;
  suffix?: string;
}

export interface SelectOption {
  value: string | number;
  label: string;
  image?: string | null;
  initials?: string;
  subtitle?: string;
}

interface SelectProps {
  label?: string;
  value?: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  error?: string;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

// --- Components ---

export const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h2>
      {action}
    </div>
    {children}
  </div>
);

export const Input: React.FC<BaseInputProps> = ({ label, error, icon: Icon, prefix, suffix, className, ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon size={16} />
        </div>
      )}
      {prefix && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold pointer-events-none">
          {prefix}
        </div>
      )}
      <input
        className={`
          w-full bg-white border rounded-lg text-sm shadow-sm transition-all min-h-[44px]
          focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
          ${Icon || prefix ? 'pl-9' : 'pl-3'} ${suffix ? 'pr-8' : 'pr-3'} py-2.5
          ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
          disabled:bg-slate-50 disabled:text-slate-500
        `}
        dir="auto"
        {...props}
      />
      {suffix && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">
          {suffix}
        </div>
      )}
    </div>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

export const Select: React.FC<SelectProps> = ({ 
  label, 
  value, 
  onChange, 
  options, 
  error, 
  className, 
  placeholder = "Sélectionner...",
  searchable = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { isMobile } = useMediaQuery();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={className} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full bg-white border rounded-lg text-sm shadow-sm transition-all min-h-[44px]
            focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
            px-3 py-2.5 text-left flex items-center justify-between
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
            ${isOpen ? 'ring-2 ring-slate-900 border-transparent' : ''}
          `}
        >
          <span className={`truncate ${selectedOption ? 'text-slate-900' : 'text-slate-400'} flex-1`}>
            {selectedOption ? (
               <div className="flex items-center gap-2.5">
                  {selectedOption.image ? (
                    <img src={selectedOption.image} className="w-5 h-5 rounded-full object-cover border border-slate-100 shrink-0" alt="" />
                  ) : selectedOption.initials ? (
                    <div className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold flex items-center justify-center text-slate-600 border border-slate-200 shrink-0">
                      {selectedOption.initials}
                    </div>
                  ) : null}
                  <span className="truncate">{selectedOption.label}</span>
               </div>
            ) : placeholder}
          </span>
          <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Desktop dropdown */}
        {!isMobile && isOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl ring-1 ring-black/5 max-h-80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 origin-top" style={{ zIndex: 'var(--z-drawer-panel)' }}>
            {searchable && (
               <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                 <div className="relative">
                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input
                     ref={searchInputRef}
                     className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:bg-white focus:ring-0 transition-colors placeholder:text-slate-400 text-slate-700"
                     placeholder="Rechercher..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                   />
                 </div>
               </div>
            )}
            <div className="overflow-y-auto p-2 custom-scrollbar">
              {filteredOptions.length > 0 ? filteredOptions.map(option => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`
                      w-full text-left px-3 py-3 rounded-lg flex items-center justify-between transition-all duration-150 group mb-1 last:mb-0 min-h-[44px]
                      ${isSelected
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                       {option.image ? (
                         <img src={option.image} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                       ) : option.initials ? (
                         <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 shadow-sm transition-colors ${isSelected ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                           {option.initials}
                         </div>
                       ) : null}

                       <div className="flex flex-col min-w-0 flex-1">
                         <div className={`text-sm leading-tight ${isSelected ? 'font-medium' : 'font-normal'}`}>
                           {option.label}
                         </div>
                         {option.subtitle && (
                           <div className={`text-xs truncate mt-0.5 transition-colors font-normal ${isSelected ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                             {option.subtitle}
                           </div>
                         )}
                       </div>
                    </div>

                    {isSelected && (
                      <div className="text-slate-900 shrink-0 ml-3">
                        <Check size={18} strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                );
              }) : (
                <div className="py-8 px-4 text-center text-slate-500 flex flex-col items-center justify-center">
                  <Search size={24} className="opacity-20 mb-2" />
                  <span className="text-sm">Aucun résultat.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile fullscreen select */}
        {isMobile && (
          <MobileSelect
            isOpen={isOpen}
            onClose={() => { setIsOpen(false); setSearchTerm(''); }}
            value={value}
            onChange={(val) => { onChange(val); setIsOpen(false); setSearchTerm(''); }}
            options={options}
            searchable={searchable}
            placeholder={placeholder}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export const TextArea: React.FC<TextAreaProps> = ({ label, error, className, ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <textarea
      className={`
        w-full bg-white border rounded-lg text-sm shadow-sm transition-all resize-none min-h-[44px]
        focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
        px-3 py-2.5
        ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
      `}
      dir="auto"
      {...props}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);