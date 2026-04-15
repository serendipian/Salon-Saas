import { Check, Search, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SelectOption } from './FormElements';

interface MobileSelectProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  searchable?: boolean;
  placeholder?: string;
}

export const MobileSelect: React.FC<MobileSelectProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  options,
  searchable = false,
  placeholder = 'Sélectionner...',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (!isOpen) setSearchTerm('');
  }, [isOpen, searchable]);

  // Escape key + focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const handleSelect = (optValue: string | number) => {
    onChange(optValue);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={placeholder}
      className="fixed inset-0 bg-white flex flex-col"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
        <span className="font-semibold text-slate-900">{placeholder}</span>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      {searchable && (
        <div className="p-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:bg-white transition-colors placeholder:text-slate-400 min-h-[44px]"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Options list */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-4 py-4 rounded-xl flex items-center justify-between transition-all mb-1 min-h-[52px] ${
                  isSelected
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  {option.image ? (
                    <img
                      src={option.image}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
                    />
                  ) : option.initials ? (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border shrink-0 ${
                        isSelected
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                    >
                      {option.initials}
                    </div>
                  ) : null}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className={`text-sm leading-tight ${isSelected ? 'font-medium' : ''}`}>
                      {option.label}
                    </div>
                    {option.subtitle && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {option.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="text-slate-900 shrink-0 ml-3">
                    <Check size={20} strokeWidth={2.5} />
                  </div>
                )}
              </button>
            );
          })
        ) : (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center">
            <Search size={28} className="opacity-20 mb-3" />
            <span className="text-sm">Aucun résultat.</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
