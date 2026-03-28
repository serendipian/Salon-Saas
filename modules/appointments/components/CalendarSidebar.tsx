import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ServiceCategory, StaffMember } from '../../../types';
import InlineCalendar from './InlineCalendar';
import { getCategoryCalendarColors, getStaffDotColor } from './calendarColors';

interface CalendarSidebarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  serviceCategories: ServiceCategory[];
  allStaff: StaffMember[];
  categoryFilters: Set<string>;
  staffFilters: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleStaff: (id: string) => void;
}

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  currentDate,
  onDateSelect,
  serviceCategories,
  allStaff,
  categoryFilters,
  staffFilters,
  onToggleCategory,
  onToggleStaff,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(true);

  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  const handleCalendarChange = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    onDateSelect(new Date(y, m - 1, d));
  };

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-slate-200 bg-white p-4 space-y-5 overflow-y-auto">
      <InlineCalendar value={dateStr} onChange={handleCalendarChange} />

      <div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center justify-between w-full text-sm font-semibold text-slate-900 mb-3"
        >
          Filtres
          {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {filtersOpen && (
          <div className="space-y-4">
            <div className="space-y-2">
              {serviceCategories.map(cat => {
                const colors = getCategoryCalendarColors(cat.color);
                const checked = categoryFilters.has(cat.id);
                return (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleCategory(cat.id)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors ${
                        checked
                          ? `${colors.dot} border-transparent`
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {cat.name}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="border-t border-slate-100" />

            <div className="space-y-2">
              {allStaff.map(staff => {
                const dotColor = getStaffDotColor(staff.color);
                const checked = staffFilters.has(staff.id);
                return (
                  <label
                    key={staff.id}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleStaff(staff.id)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors ${
                        checked
                          ? `${dotColor} border-transparent`
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {staff.firstName} {staff.lastName}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
