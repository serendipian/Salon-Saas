import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { buildPermissions, type PermissionResult, type RoleOverride } from './usePermissions';
import { useRealtimeSync } from './useRealtimeSync';

/**
 * Salon-aware permission hook: pulls the active role from AuthContext, fetches
 * the salon's per-role overrides, and returns the merged {can, accessLevel} API.
 * Realtime-synced — an owner toggling a permission propagates to other open
 * sessions without a refresh.
 */
export function useSalonPermissions(): PermissionResult {
  const { role, activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';

  useRealtimeSync('salon_role_overrides');

  const { data: overrides } = useQuery({
    queryKey: ['salon_role_overrides', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salon_role_overrides')
        .select('role, resource, action, granted')
        .eq('salon_id', salonId);
      if (error) throw error;
      return data as RoleOverride[];
    },
    enabled: !!salonId,
  });

  return useMemo(() => buildPermissions(role, overrides ?? []), [role, overrides]);
}
