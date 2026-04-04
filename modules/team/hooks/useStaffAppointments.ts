import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { WorkSchedule } from '../../../types';
import { countWorkingDays } from '../utils';

export const useStaffAppointments = (staffId: string, schedule?: WorkSchedule) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['staff_appointments', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(first_name, last_name), services(name)')
        .eq('staff_id', staffId)
        .eq('salon_id', salonId!)
        .gte('date', today.toISOString())
        .lte('date', weekEnd.toISOString())
        .is('deleted_at', null)
        .neq('status', 'CANCELLED')
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!salonId && !!staffId,
  });

  const todayAppointments = useMemo(
    () => appointments.filter((a: any) => new Date(a.date).toDateString() === today.toDateString()),
    [appointments, today]
  );

  const bookingRate = useMemo(() => {
    if (!schedule) return null;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const workDays = countWorkingDays(monthStart, now, schedule);
    if (workDays === 0) return null;
    const totalSlots = workDays * 8;
    const bookedCount = appointments.length;
    return Math.min(100, Math.round((bookedCount / totalSlots) * 100));
  }, [appointments, schedule, now]);

  return { upcoming: appointments, today: todayAppointments, bookingRate, isLoading };
};
