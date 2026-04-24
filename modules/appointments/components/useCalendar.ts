import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Appointment, ServiceCategory, StaffMember } from '../../../types';

export type CalendarViewMode = 'team' | 'day' | 'week' | 'month';

export interface UseCalendarReturn {
  currentDate: Date;
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  goToDate: (date: Date) => void;
  categoryFilters: Set<string>;
  staffFilters: Set<string>;
  toggleCategory: (id: string) => void;
  toggleStaff: (id: string) => void;
  filteredAppointments: Appointment[];
}

export function useCalendar(
  allAppointments: Appointment[],
  serviceCategories: ServiceCategory[],
  services: { id: string; categoryId: string }[],
  allStaff: StaffMember[],
): UseCalendarReturn {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('team');

  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(
    () => new Set(serviceCategories.map((c) => c.id)),
  );
  const [staffFilters, setStaffFilters] = useState<Set<string>>(
    () => new Set(allStaff.map((s) => s.id)),
  );

  // Sync filters when data arrives asynchronously
  useEffect(() => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      for (const c of serviceCategories) next.add(c.id);
      return next.size !== prev.size ? next : prev;
    });
  }, [serviceCategories]);

  useEffect(() => {
    setStaffFilters((prev) => {
      const next = new Set(prev);
      for (const s of allStaff) next.add(s.id);
      return next.size !== prev.size ? next : prev;
    });
  }, [allStaff]);

  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day' || viewMode === 'team') d.setDate(d.getDate() - 1);
      else if (viewMode === 'week') d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, [viewMode]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day' || viewMode === 'team') d.setDate(d.getDate() + 1);
      else if (viewMode === 'week') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, [viewMode]);

  const goToDate = useCallback((date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleStaff = useCallback((id: string) => {
    setStaffFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const serviceCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) map.set(s.id, s.categoryId);
    return map;
  }, [services]);

  const filteredAppointments = useMemo(() => {
    return allAppointments.filter((appt) => {
      const catId = serviceCategoryMap.get(appt.serviceId);
      if (catId && !categoryFilters.has(catId)) return false;
      if (!staffFilters.has(appt.staffId)) return false;
      return true;
    });
  }, [allAppointments, serviceCategoryMap, categoryFilters, staffFilters]);

  return {
    currentDate,
    viewMode,
    setViewMode,
    goToday,
    goPrev,
    goNext,
    goToDate,
    categoryFilters,
    staffFilters,
    toggleCategory,
    toggleStaff,
    filteredAppointments,
  };
}
