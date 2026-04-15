import React, { useState, useRef, useEffect } from 'react';

const COLOR_PRESETS = [
  { value: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-400' },
  { value: 'bg-pink-100 text-pink-800 border-pink-200', dot: 'bg-pink-400' },
  { value: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-400' },
  { value: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-400' },
  { value: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-400' },
  { value: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-400' },
  { value: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400' },
  { value: 'bg-lime-100 text-lime-800 border-lime-200', dot: 'bg-lime-400' },
  { value: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-400' },
  { value: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-400' },
  { value: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-400' },
  { value: 'bg-cyan-100 text-cyan-800 border-cyan-200', dot: 'bg-cyan-400' },
  { value: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-400' },
  { value: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-400' },
  { value: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-400' },
  { value: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-400' },
  { value: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-400' },
  { value: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', dot: 'bg-fuchsia-400' },
];

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentDot = COLOR_PRESETS.find((c) => c.value === selectedColor)?.dot ?? 'bg-slate-400';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        title="Choisir une couleur"
      >
        <span className={`w-4 h-4 rounded-full ${currentDot}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-6 gap-1 w-48">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => {
                onSelect(color.value);
                setOpen(false);
              }}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                selectedColor === color.value
                  ? 'ring-2 ring-slate-900 ring-offset-1'
                  : 'hover:ring-2 hover:ring-slate-300'
              }`}
            >
              <span className={`w-4 h-4 rounded-full ${color.dot}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
