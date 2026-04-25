import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { rawSelect } from '../lib/supabaseRaw';
import { toStaffMember } from '../modules/team/mappers';
import type { StaffMember } from '../types';

export function useLinkedStaffMember() {
  const { activeSalon, memberships } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Find the current user's membership ID for the active salon
  const membershipId = memberships.find((m) => m.salon_id === salonId)?.id ?? '';

  const { data: linkedStaff = null, isLoading } = useQuery<StaffMember | null>({
    queryKey: ['linked-staff', salonId, membershipId],
    queryFn: async ({ signal }) => {
      if (!membershipId) return null;
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('salon_id', `eq.${salonId}`);
      params.append('membership_id', `eq.${membershipId}`);
      params.append('deleted_at', 'is.null');
      params.append('limit', '1');
      const data = await rawSelect<Parameters<typeof toStaffMember>[0]>(
        'staff_members',
        params.toString(),
        signal,
      );
      const row = data[0];
      if (!row) return null;
      return toStaffMember(row);
    },
    enabled: !!salonId && !!membershipId,
  });

  return { linkedStaff, isLoading };
}
