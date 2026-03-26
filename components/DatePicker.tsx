import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface DatePickerProps {
  label?: string;
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  error?: string;
  placeholder?: string;
}

// Helper to get safe local date from YYYY-MM-DD string
const parseDate = (str?: string) => {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startingBlankDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Mon start

  const days = [];
  for (let i = 0; i < startingBlankDays; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
};

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, error, placeholder = "Sélectionner date" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // View state tracks the month being displayed
  const [viewDate, setViewDate] = useState(parseDate(value));

  useEffect(() => {
    if (isOpen && value) {
      setViewDate(parseDate(value));
    }
  }, [isOpen, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDayClick = (day: number) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    // Create YYYY-MM-DD string manually to avoid UTC issues
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    onChange(`${year}-${monthStr}-${dayStr}`);
    setIsOpen(false);
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setViewDate(newDate);
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return placeholder;
    const date = parseDate(dateStr);
    if (isNaN(date.getTime())) return 'Date invalide';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full bg-white border rounded-lg text-sm shadow-sm transition-all
            focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
            px-3 py-2 text-left flex items-center justify-between group
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
            ${isOpen ? 'ring-2 ring-slate-900 border-transparent' : 'hover:border-slate-400'}
          `}
        >
          <div className="flex items-center gap-2.5">
            <CalendarIcon size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>
              {formatDateDisplay(value)}
            </span>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-[100] top-[calc(100%+4px)] left-0 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 w-[300px] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-left">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-slate-800 capitalize text-sm">
                {viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                <div key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(viewDate).map((day, idx) => {
                if (!day) return <div key={`blank-${idx}`} />;
                
                // Check if selected
                const currentDayStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isSelected = value === currentDayStr;
                const isToday = new Date().toISOString().slice(0,10) === currentDayStr;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`
                      h-8 w-8 rounded-lg text-xs flex items-center justify-center transition-all relative
                      ${isSelected 
                        ? 'bg-slate-900 text-white font-bold shadow-md scale-105 z-10' 
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                      }
                      ${isToday && !isSelected ? 'text-slate-900 font-bold ring-1 ring-slate-200 bg-slate-50' : ''}
                    `}
                  >
                    {day}
                    {isToday && !isSelected && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-400"></div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};