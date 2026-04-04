import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Section } from '../../components/FormElements';
import { formatPrice } from '../../lib/format';
import type { StaffMember } from '../../types';

interface ProfilePerformanceProps {
  linkedStaff: StaffMember;
}

export const ProfilePerformance: React.FC<ProfilePerformanceProps> = ({ linkedStaff }) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Current month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: stats } = useQuery({
    queryKey: ['profile-performance', salonId, linkedStaff.id, now.getMonth()],
    queryFn: async () => {
      // Count completed appointments this month
      const { count: appointmentCount, error: apptError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .eq('staff_id', linkedStaff.id)
        .eq('status', 'COMPLETED')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .is('deleted_at', null);
      if (apptError) throw apptError;

      // Sum revenue from completed appointments
      const { data: revenueData, error: revError } = await supabase
        .from('appointments')
        .select('price')
        .eq('salon_id', salonId)
        .eq('staff_id', linkedStaff.id)
        .eq('status', 'COMPLETED')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .is('deleted_at', null);
      if (revError) throw revError;

      const revenue = (revenueData ?? []).reduce((sum, a) => sum + parseFloat(String(a.price)), 0);

      return {
        appointments: appointmentCount ?? 0,
        revenue,
      };
    },
    enabled: !!salonId,
  });

  return (
    <Section title="Mes Performances">
      <p className="text-xs text-slate-500 mb-4">Ce mois-ci</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck size={16} className="text-pink-500" />
            <span className="text-xs font-medium text-slate-500">Rendez-vous</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.appointments ?? '—'}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-slate-500">Chiffre d'affaires</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {stats ? formatPrice(stats.revenue) : '—'}
          </p>
        </div>
      </div>
    </Section>
  );
};
