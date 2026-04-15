import React, { useState, useRef, useEffect } from 'react';
import { ICON_PICKER_LIST, RegistryIcon } from '../../../lib/categoryIcons';

interface IconPickerProps {
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
}

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedEntry = ICON_PICKER_LIST.find((i) => i.name === selectedIcon);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        title={selectedEntry?.label ?? 'Choisir une icône'}
      >
        {selectedIcon ? (
          <RegistryIcon name={selectedIcon} size={18} className="text-slate-700" />
        ) : (
          <span className="text-slate-400 text-lg">+</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1 w-56">
          {ICON_PICKER_LIST.map((icon) => (
            <button
              key={icon.name}
              type="button"
              onClick={() => {
                onSelect(icon.name);
                setOpen(false);
              }}
              title={icon.label}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                selectedIcon === icon.name
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <RegistryIcon name={icon.name} size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
