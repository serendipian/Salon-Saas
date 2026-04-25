import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rawSelect } from '../../../lib/supabaseRaw';
import type { WorkSchedule } from '../../../types';
import { countWorkingDays } from '../utils';

export const useStaffAppointments = (staffId: string, schedule?: WorkSchedule) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;

  // Stable date references — only recompute if the calendar day changes
  const todayKey = new Date().toISOString().slice(0, 10);
  const { today, weekEnd } = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number);
    const t = new Date(y, m - 1, d);
    const w = new Date(t);
    w.setDate(w.getDate() + 7);
    return { today: t, weekEnd: w };
  }, [todayKey]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['staff_appointments', salonId, staffId, today.toISOString()],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*,clients(first_name,last_name),services(name)');
      params.append('staff_id', `eq.${staffId}`);
      params.append('salon_id', `eq.${salonId!}`);
      params.append('date', `gte.${today.toISOString()}`);
      params.append('date', `lte.${weekEnd.toISOString()}`);
      params.append('deleted_at', 'is.null');
      params.append('status', 'neq.CANCELLED');
      params.append('order', 'date.asc');
      // biome-ignore lint/suspicious/noExplicitAny: row shape is downstream-only
      return rawSelect<any>('appointments', params.toString(), signal);
    },
    enabled: !!salonId && !!staffId,
  });

  const todayAppointments = useMemo(
    () => appointments.filter((a) => new Date(a.date).toDateString() === today.toDateString()),
    [appointments, today],
  );

  const bookingRate = useMemo(() => {
    if (!schedule) return null;
    // Use the same 7-day window as the query for consistency
    const workDays = countWorkingDays(today, weekEnd, schedule);
    if (workDays === 0) return null;
    // Calculate slots from actual schedule hours, not hardcoded 8
    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const;
    let totalSlots = 0;
    const d = new Date(today);
    while (d <= weekEnd) {
      const day = schedule[dayNames[d.getDay()]];
      if (day?.isOpen && day.start && day.end) {
        const [sh, sm] = day.start.split(':').map(Number);
        const [eh, em] = day.end.split(':').map(Number);
        const hours = eh + em / 60 - (sh + sm / 60);
        totalSlots += Math.max(0, Math.floor(hours));
      }
      d.setDate(d.getDate() + 1);
    }
    if (totalSlots === 0) return null;
    return Math.min(100, Math.round((appointments.length / totalSlots) * 100));
  }, [appointments, schedule, today, weekEnd]);

  return { upcoming: appointments, today: todayAppointments, bookingRate, isLoading };
};
