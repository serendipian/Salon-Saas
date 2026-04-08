import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toStaffMember } from '../modules/team/mappers';
import type { StaffMember } from '../types';

export function useLinkedStaffMember() {
  const { activeSalon, memberships } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Find the current user's membership ID for the active salon
  const membershipId = memberships.find(m => m.salon_id === salonId)?.id ?? '';

  const { data: linkedStaff = null, isLoading } = useQuery<StaffMember | null>({
    queryKey: ['linked-staff', salonId, membershipId],
    queryFn: async () => {
      if (!membershipId) return null;
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('salon_id', salonId)
        .eq('membership_id', membershipId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return toStaffMember(data as any);
    },
    enabled: !!salonId && !!membershipId,
  });

  return { linkedStaff, isLoading };
}
