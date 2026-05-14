import {
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../context/MediaQueryContext';
import { useSalonTimezone } from '../hooks/useSalonTimezone';
import {
  addDaysInSalon,
  endOfDayInSalon,
  endOfMonthInSalon,
  salonDateString,
  salonInstantFromParts,
  startOfDayInSalon,
  startOfMonthInSalon,
  startOfYearInSalon,
} from '../lib/salonTime';
import type { DateRange } from '../types';

interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

// --- Logic & Helpers ---

interface Preset {
  label: string;
  getValue: () => { from: Date; to: Date };
}

/**
 * Presets are timezone-bound: each `getValue` resolves "today", "this month",
 * etc. against the salon's calendar day, not the browser's. Same query result
 * regardless of where the user's laptop is.
 */
function buildPresets(tz: string): Preset[] {
  return [
    {
      label: "Aujourd'hui",
      getValue: () => ({ from: startOfDayInSalon(new Date(), tz), to: endOfDayInSalon(new Date(), tz) }),
    },
    {
      label: 'Hier',
      getValue: () => {
        const yesterday = addDaysInSalon(new Date(), -1, tz);
        return { from: yesterday, to: endOfDayInSalon(yesterday, tz) };
      },
    },
    {
      label: '7 derniers jours',
      getValue: () => ({
        from: addDaysInSalon(new Date(), -6, tz),
        to: endOfDayInSalon(new Date(), tz),
      }),
    },
    {
      label: '30 derniers jours',
      getValue: () => ({
        from: addDaysInSalon(new Date(), -29, tz),
        to: endOfDayInSalon(new Date(), tz),
      }),
    },
    {
      label: 'Ce mois-ci',
      getValue: () => ({
        from: startOfMonthInSalon(new Date(), tz),
        to: endOfDayInSalon(new Date(), tz),
      }),
    },
    {
      label: 'Le mois dernier',
      getValue: () => {
        // First-of-last-month: shift today back to first-of-this-month then -1 day → last day of previous month, then start-of-month again.
        const startThisMonth = startOfMonthInSalon(new Date(), tz);
        const lastDayPrev = addDaysInSalon(startThisMonth, -1, tz);
        return { from: startOfMonthInSalon(lastDayPrev, tz), to: endOfMonthInSalon(lastDayPrev, tz) };
      },
    },
    {
      label: 'Cette année',
      getValue: () => ({
        from: startOfYearInSalon(new Date(), tz),
        to: endOfDayInSalon(new Date(), tz),
      }),
    },
  ];
}

const getDaysInMonth = (date: Date) => {
  if (Number.isNaN(date.getTime())) return [];
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startingBlankDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const days = [];
  for (let i = 0; i < startingBlankDays; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
};

const formatDateDisplay = (date: Date) => {
  if (!date || Number.isNaN(new Date(date).getTime())) return '-';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
};

// --- Sub-Components ---

const PresetSidebar: React.FC<{
  presets: Preset[];
  currentLabel?: string;
  onSelect: (preset: Preset) => void;
}> = ({ presets, currentLabel, onSelect }) => (
  <div className="w-48 bg-slate-50 border-r border-slate-200 p-2 flex flex-col gap-1 shrink-0">
    <div className="px-3 pt-2 pb-2 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
      Période
    </div>

    {/* Custom Button */}
    <button
      type="button"
      className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
        currentLabel === 'Personnalisé'
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
      }`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      Personnalisé
      {currentLabel === 'Personnalisé' && <Check size={14} />}
    </button>

    <div className="h-px bg-slate-200 my-1 mx-2" />

    {/* Presets */}
    {presets.map((preset) => (
      <button
        key={preset.label}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(preset);
        }}
        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
          currentLabel === preset.label
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
            : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
        }`}
      >
        {preset.label}
        {currentLabel === preset.label && <Check size={14} />}
      </button>
    ))}
  </div>
);

const DayCell: React.FC<{
  day: number | null;
  monthDate: Date;
  tempRange: DateRange;
  tz: string;
  onClick: (year: number, month1: number, day: number) => void;
}> = ({ day, monthDate, tempRange, tz, onClick }) => {
  if (!day) return <div />;

  // Compare salon-local day strings — independent of browser TZ. The cell's
  // y/m/d come from the calendar grid (not tied to any TZ), so we format them
  // as ISO `YYYY-MM-DD` directly.
  const cellDayStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const fromDayStr = salonDateString(tempRange.from, tz);
  const toDayStr = salonDateString(tempRange.to, tz);

  const isSelected = cellDayStr >= fromDayStr && cellDayStr <= toDayStr;
  const isStart = cellDayStr === fromDayStr;
  const isEnd = cellDayStr === toDayStr;

  let roundedClass = 'rounded-lg';
  if (isStart && isEnd) roundedClass = 'rounded-lg';
  else if (isStart) roundedClass = 'rounded-l-lg rounded-r-none';
  else if (isEnd) roundedClass = 'rounded-r-lg rounded-l-none';
  else if (isSelected) roundedClass = 'rounded-none';

  return (
    <div className="relative p-[1px]">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(monthDate.getFullYear(), monthDate.getMonth() + 1, day);
        }}
        className={`
          w-full h-8 text-sm font-medium transition-colors relative z-10 flex items-center justify-center
          ${isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}
          ${isStart || isEnd ? '!bg-slate-900 !text-white z-20 shadow-md scale-105' : ''}
          ${roundedClass}
        `}
      >
        {day}
      </button>
    </div>
  );
};

const MonthGrid: React.FC<{
  monthDate: Date;
  tempRange: DateRange;
  tz: string;
  onDayClick: (year: number, month1: number, day: number) => void;
}> = ({ monthDate, tempRange, tz, onDayClick }) => {
  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-0 mb-2 text-center">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={`${d}-${i}`} className="text-xs font-medium text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 gap-x-0">
        {getDaysInMonth(monthDate).map((day, idx) => (
          <DayCell
            key={day ? `day-${day}` : `blank-${idx}`}
            day={day}
            monthDate={monthDate}
            tempRange={tempRange}
            tz={tz}
            onClick={onDayClick}
          />
        ))}
      </div>
    </div>
  );
};

// --- Main Component ---

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ dateRange, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMediaQuery();
  const tz = useSalonTimezone();
  const presets = useMemo(() => buildPresets(tz), [tz]);

  // State
  // Normalize initial viewDate to the 1st of the month to avoid 31st->Next Month skips
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(dateRange.from);
    d.setDate(1);
    return d;
  });
  const [tempRange, setTempRange] = useState<DateRange>(dateRange);
  const [editMode, setEditMode] = useState<'START' | 'END' | null>(null);

  // Right Calendar is always next month
  const nextMonthDate = new Date(viewDate);
  nextMonthDate.setDate(1); // Ensure safety
  nextMonthDate.setMonth(viewDate.getMonth() + 1);

  useEffect(() => {
    if (isOpen) {
      setTempRange(dateRange);
      // Reset view to range start (normalized)
      const d = new Date(dateRange.from);
      d.setDate(1);
      setViewDate(d);
      setEditMode(null);
    }
  }, [dateRange, isOpen]);

  // Click outside — desktop only
  useEffect(() => {
    if (isMobile) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditMode(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setEditMode(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Body scroll lock — mobile only
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen]);

  const handlePresetSelect = (preset: Preset) => {
    const range = preset.getValue();
    const newRange = { ...range, label: preset.label };
    setTempRange(newRange);

    // Update view
    const d = new Date(newRange.from);
    d.setDate(1);
    setViewDate(d);

    onChange(newRange);
    setIsOpen(false);
  };

  // For mobile: set range but don't close
  const handleMobilePresetSelect = (preset: Preset) => {
    const range = preset.getValue();
    const newRange = { ...range, label: preset.label };
    setTempRange(newRange);
    const d = new Date(newRange.from);
    d.setDate(1);
    setViewDate(d);
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(1); // Ensure we are on the 1st before shifting months
    newDate.setMonth(newDate.getMonth() + delta);
    setViewDate(newDate);
  };

  const handleDayClick = (year: number, month1: number, day: number) => {
    // Materialize the clicked cell into salon-local start-of-day and end-of-day.
    const clickedStart = salonInstantFromParts(year, month1, day, 0, 0, 0, 0, tz);
    const clickedEnd = salonInstantFromParts(year, month1, day, 23, 59, 59, 999, tz);

    let nextFrom = new Date(tempRange.from);
    let nextTo = new Date(tempRange.to);
    let nextEditMode = editMode;

    if (editMode === 'START') {
      nextFrom = clickedStart;
      if (nextFrom.getTime() > nextTo.getTime()) nextTo = clickedEnd;
      nextEditMode = 'END';
    } else if (editMode === 'END') {
      nextTo = clickedEnd;
      if (nextTo.getTime() < nextFrom.getTime()) nextFrom = clickedStart;
      nextEditMode = null;
    } else {
      const currentFromStr = salonDateString(tempRange.from, tz);
      const currentToStr = salonDateString(tempRange.to, tz);
      const isRangeSelected = currentFromStr !== currentToStr;

      if (isRangeSelected) {
        nextFrom = clickedStart;
        nextTo = clickedEnd;
      } else if (clickedStart.getTime() < nextFrom.getTime()) {
        nextFrom = clickedStart;
      } else {
        nextTo = clickedEnd;
      }
    }

    setTempRange({ from: nextFrom, to: nextTo, label: 'Personnalisé' });
    setEditMode(nextEditMode);
  };

  const toggleEditMode = (mode: 'START' | 'END') => {
    if (editMode === mode) {
      setEditMode(null);
    } else {
      setEditMode(mode);
      // Jump view to relevant date (normalized)
      const targetDate = mode === 'START' ? tempRange.from : tempRange.to;
      const d = new Date(targetDate);
      d.setDate(1);
      setViewDate(d);
    }
  };

  const formatButtonLabel = () => {
    if (dateRange.label && dateRange.label !== 'Personnalisé') return dateRange.label;
    // Single-day range — compared in salon-local time so an "Aujourd'hui" range
    // doesn't get rendered as a two-date span just because the from/to instants
    // straddle browser-local midnight.
    if (salonDateString(dateRange.from, tz) === salonDateString(dateRange.to, tz)) {
      return new Date(dateRange.from).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        timeZone: tz,
      });
    }
    return `${formatDateDisplay(dateRange.from)} - ${formatDateDisplay(dateRange.to)}`;
  };

  const shiftPeriod = (direction: -1 | 1) => {
    const fromStart = startOfDayInSalon(dateRange.from, tz);
    const toStart = startOfDayInSalon(dateRange.to, tz);

    // Span in salon-local days (rounded — DST transitions make a "day" 23 or 25h).
    const spanDays =
      Math.round((toStart.getTime() - fromStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const newFrom = addDaysInSalon(fromStart, direction * spanDays, tz);
    const newTo = endOfDayInSalon(addDaysInSalon(newFrom, spanDays - 1, tz), tz);

    // Label: only "Hier" / "Aujourd'hui" / "Demain" for single-day ranges, in salon-local
    let label: string | undefined;
    if (spanDays === 1) {
      const newFromStr = salonDateString(newFrom, tz);
      const todayStr = salonDateString(new Date(), tz);
      const tomorrowStr = salonDateString(addDaysInSalon(new Date(), 1, tz), tz);
      const yesterdayStr = salonDateString(addDaysInSalon(new Date(), -1, tz), tz);
      if (newFromStr === todayStr) label = "Aujourd'hui";
      else if (newFromStr === yesterdayStr) label = 'Hier';
      else if (newFromStr === tomorrowStr) label = 'Demain';
    }

    onChange({ from: newFrom, to: newTo, label });
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center rounded-lg border border-slate-300 shadow-sm overflow-hidden bg-white">
        <button
          onClick={() => shiftPeriod(-1)}
          type="button"
          className="px-2 py-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border-r border-slate-200"
          aria-label="Période précédente"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          type="button"
          className="flex items-center justify-center gap-2 px-3 py-1.5 min-w-[180px] hover:bg-slate-50 transition-colors text-slate-700 group"
        >
          <CalendarIcon size={15} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">{formatButtonLabel()}</span>
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          onClick={() => shiftPeriod(1)}
          type="button"
          className="px-2 py-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border-l border-slate-200"
          aria-label="Période suivante"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Desktop dropdown */}
      {isOpen && !isMobile && (
        <div
          className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 ring-1 ring-black/5 flex overflow-hidden w-[800px] animate-in fade-in zoom-in-95 duration-200 origin-top-right"
          style={{ zIndex: 'var(--z-drawer-panel)' }}
        >
          <PresetSidebar presets={presets} currentLabel={dateRange.label} onSelect={handlePresetSelect} />

          <div className="flex-1 p-5 flex flex-col">
            {/* Header Inputs */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
              {/* Start Button */}
              <div className="flex-1 relative">
                <label className="block text-[10px] font-bold uppercase mb-1 text-slate-400">
                  Du (Début)
                </label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleEditMode('START');
                  }}
                  className={`
                      w-full pl-3 pr-3 py-2.5 text-sm border rounded-lg font-medium flex items-center justify-between transition-all shadow-sm
                      ${
                        editMode === 'START'
                          ? 'border-slate-900 ring-2 ring-slate-900 text-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-400 text-slate-700 bg-white'
                      }
                    `}
                >
                  <span>{tempRange.from.toLocaleDateString('fr-FR')}</span>
                  {editMode === 'START' && (
                    <div className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
                  )}
                </button>
              </div>

              <ArrowRight size={16} className="text-slate-300 mt-4" />

              {/* End Button */}
              <div className="flex-1 relative">
                <label className="block text-[10px] font-bold uppercase mb-1 text-slate-400">
                  Au (Fin)
                </label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleEditMode('END');
                  }}
                  className={`
                      w-full pl-3 pr-3 py-2.5 text-sm border rounded-lg font-medium flex items-center justify-between transition-all shadow-sm
                      ${
                        editMode === 'END'
                          ? 'border-slate-900 ring-2 ring-slate-900 text-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-400 text-slate-700 bg-white'
                      }
                    `}
                >
                  <span>{tempRange.to.toLocaleDateString('fr-FR')}</span>
                  {editMode === 'END' && (
                    <div className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
                  )}
                </button>
              </div>
            </div>

            {/* Dual Calendar Grid Layout */}
            <div className="grid grid-cols-2 gap-8 relative">
              {/* Left Calendar */}
              <div className="relative">
                <div className="flex items-center justify-center mb-4 relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      changeMonth(-1);
                    }}
                    className="absolute left-0 p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="font-bold text-slate-800 capitalize text-sm">
                    {viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <MonthGrid monthDate={viewDate} tempRange={tempRange} tz={tz} onDayClick={handleDayClick} />
              </div>

              {/* Separator */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-100 -ml-px"></div>

              {/* Right Calendar */}
              <div className="relative">
                <div className="flex items-center justify-center mb-4 relative">
                  <span className="font-bold text-slate-800 capitalize text-sm">
                    {nextMonthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      changeMonth(1);
                    }}
                    className="absolute right-0 p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                <MonthGrid
                  monthDate={nextMonthDate}
                  tempRange={tempRange}
                  tz={tz}
                  onDayClick={handleDayClick}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-auto pt-5 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-all shadow-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(tempRange);
                  setIsOpen(false);
                }}
                className="px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile fullscreen bottom-sheet */}
      {isOpen &&
        isMobile &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/40 flex items-end justify-center"
            style={{ zIndex: 'var(--z-modal)' }}
          >
            <div
              className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner une période"
            >
              {/* Sticky header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
                <h2 className="text-base font-bold text-slate-900">Période</h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setEditMode(null);
                  }}
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Horizontal preset strip */}
              <div
                className="px-5 py-3 border-b border-slate-100 overflow-x-auto flex gap-2"
                style={{ scrollbarWidth: 'none' }}
              >
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleMobilePresetSelect(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors shrink-0 ${
                      tempRange.label === preset.label
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Two-tap indicator */}
              <div className="px-5 py-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleEditMode('START')}
                  className={`flex-1 px-3 py-2 border rounded-lg text-sm font-medium text-left ${
                    editMode === 'START'
                      ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                    1. Date de début
                  </div>
                  {tempRange.from.toLocaleDateString('fr-FR')}
                </button>
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
                <button
                  type="button"
                  onClick={() => toggleEditMode('END')}
                  className={`flex-1 px-3 py-2 border rounded-lg text-sm font-medium text-left ${
                    editMode === 'END'
                      ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                    2. Date de fin
                  </div>
                  {tempRange.to.toLocaleDateString('fr-FR')}
                </button>
              </div>

              {/* Single calendar with month nav */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="font-bold text-slate-800 capitalize text-sm">
                    {viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <MonthGrid monthDate={viewDate} tempRange={tempRange} tz={tz} onDayClick={handleDayClick} />
              </div>

              {/* Sticky footer */}
              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setEditMode(null);
                  }}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(tempRange);
                    setIsOpen(false);
                    setEditMode(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
