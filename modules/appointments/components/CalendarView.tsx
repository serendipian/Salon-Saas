
import React, { useState, useCallback, useMemo } from 'react';
import { Appointment, ServiceCategory, StaffMember, Service } from '../../../types';
import { useCalendar } from './useCalendar';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
import { CalendarDayView } from './CalendarDayView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarEventPopover } from './CalendarEventPopover';

interface CalendarViewProps {
  allAppointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  allStaff: StaffMember[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  allAppointments,
  serviceCategories,
  services,
  allStaff,
  onViewDetails,
  onEdit,
}) => {
  const calendar = useCalendar(allAppointments, serviceCategories, services, allStaff);

  const [popover, setPopover] = useState<{
    appointment: Appointment;
    rect: DOMRect;
  } | null>(null);

  const handleEventClick = useCallback((appointment: Appointment, rect: DOMRect) => {
    setPopover({ appointment, rect });
  }, []);

  const closePopover = useCallback(() => setPopover(null), []);

  const handleViewDetails = useCallback((id: string) => {
    setPopover(null);
    onViewDetails(id);
  }, [onViewDetails]);

  const handleEdit = useCallback((id: string) => {
    setPopover(null);
    onEdit(id);
  }, [onEdit]);

  const serviceData = useMemo(() => services.map(s => ({ id: s.id, categoryId: s.categoryId })), [services]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <CalendarSidebar
          currentDate={calendar.currentDate}
          onDateSelect={calendar.goToDate}
          serviceCategories={serviceCategories}
          allStaff={allStaff}
          categoryFilters={calendar.categoryFilters}
          staffFilters={calendar.staffFilters}
          onToggleCategory={calendar.toggleCategory}
          onToggleStaff={calendar.toggleStaff}
        />

        {/* Main calendar area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CalendarHeader
            currentDate={calendar.currentDate}
            viewMode={calendar.viewMode}
            onViewModeChange={calendar.setViewMode}
            onToday={calendar.goToday}
            onPrev={calendar.goPrev}
            onNext={calendar.goNext}
          />

          {calendar.viewMode === 'day' && (
            <CalendarDayView
              currentDate={calendar.currentDate}
              appointments={calendar.filteredAppointments}
              serviceCategories={serviceCategories}
              services={serviceData}
              onEventClick={handleEventClick}
            />
          )}

          {calendar.viewMode === 'week' && (
            <CalendarWeekView
              currentDate={calendar.currentDate}
              appointments={calendar.filteredAppointments}
              serviceCategories={serviceCategories}
              services={serviceData}
              onEventClick={handleEventClick}
            />
          )}

          {calendar.viewMode === 'month' && (
            <CalendarMonthView
              currentDate={calendar.currentDate}
              appointments={calendar.filteredAppointments}
              serviceCategories={serviceCategories}
              services={serviceData}
              onEventClick={handleEventClick}
              onDateClick={calendar.goToDate}
            />
          )}
        </div>
      </div>

      {/* Popover */}
      {popover && (
        <CalendarEventPopover
          appointment={popover.appointment}
          anchorRect={popover.rect}
          onClose={closePopover}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
};
