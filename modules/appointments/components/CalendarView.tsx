import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Appointment, Service, ServiceCategory, StaffMember } from '../../../types';
import { TodayCalendarCard } from '../../dashboard/components/TodayCalendarCard';
import { CalendarDayView } from './CalendarDayView';
import { CalendarEventPopover } from './CalendarEventPopover';
import { CalendarHeader } from './CalendarHeader';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarSidebar } from './CalendarSidebar';
import { CalendarWeekView } from './CalendarWeekView';
import { useCalendar } from './useCalendar';

interface CalendarViewProps {
  allAppointments: Appointment[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  allStaff: StaffMember[];
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onUpdateAppointment?: (appt: Appointment) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  allAppointments,
  serviceCategories,
  services,
  allStaff,
  onViewDetails,
  onEdit,
  onUpdateAppointment,
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

  const handleViewDetails = useCallback(
    (id: string) => {
      setPopover(null);
      onViewDetails(id);
    },
    [onViewDetails],
  );

  const handleEdit = useCallback(
    (id: string) => {
      setPopover(null);
      onEdit(id);
    },
    [onEdit],
  );

  const serviceData = useMemo(
    () => services.map((s) => ({ id: s.id, categoryId: s.categoryId })),
    [services],
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100dvh-220px)] md:h-[calc(100vh-140px)]">
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — desktop only; mobile users get filters via list view */}
        <div className="hidden md:block">
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
        </div>

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

          {calendar.viewMode === 'team' && (
            <TodayCalendarCard
              appointments={calendar.filteredAppointments}
              services={services}
              serviceCategories={serviceCategories}
              staff={allStaff}
              onUpdateAppointment={onUpdateAppointment}
              targetDate={calendar.currentDate}
              embedded
            />
          )}

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
