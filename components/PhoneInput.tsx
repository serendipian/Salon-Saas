import React from 'react';

const DEFAULT_PREFIX = '+212';

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (fullValue: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
}

function splitPhone(value: string): { prefix: string; local: string } {
  if (value.startsWith(DEFAULT_PREFIX)) {
    return { prefix: DEFAULT_PREFIX, local: value.slice(DEFAULT_PREFIX.length) };
  }
  return { prefix: DEFAULT_PREFIX, local: value };
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
  const { local } = splitPhone(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9\s]/g, '');
    onChange(raw ? `${DEFAULT_PREFIX}${raw}` : '');
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex">
        <div className="flex items-center justify-center bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg px-3 text-sm font-semibold text-slate-600 min-h-[44px] select-none">
          {DEFAULT_PREFIX}
        </div>
        <input
          type="tel"
          inputMode="tel"
          value={local}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
          dir="auto"
          className={`
            w-full bg-white border rounded-r-lg rounded-l-none text-sm shadow-sm transition-all min-h-[44px]
            focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
            pl-3 pr-3 py-2.5
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
            disabled:bg-slate-50 disabled:text-slate-500
          `}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
