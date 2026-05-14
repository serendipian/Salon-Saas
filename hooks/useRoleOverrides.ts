import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import type { AuthAction, AuthResource, Role } from '../lib/auth.types';
import { supabase } from '../lib/supabase';
import { useMutationToast } from './useMutationToast';
import { useRealtimeSync } from './useRealtimeSync';
import type { RoleOverride } from './usePermissions';

type EditableRole = Exclude<Role, 'owner'>;

/**
 * Owner-only hook for editing the per-salon role permission matrix.
 * `setOverride(granted=null)` removes the override row (reverts to default);
 * a non-null `granted` upserts on the (salon_id, role, resource, action) unique key.
 * RLS rejects writes from non-owners — surface the error via toast.
 */
export function useRoleOverrides() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  useRealtimeSync('salon_role_overrides');

  const { data: overrides = [], isLoading } = useQuery({
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

  const setOverrideMutation = useMutation({
    mutationFn: async (params: {
      role: EditableRole;
      resource: AuthResource;
      action: AuthAction;
      granted: boolean | null;
    }) => {
      const { role, resource, action, granted } = params;
      if (granted === null) {
        const { error } = await supabase
          .from('salon_role_overrides')
          .delete()
          .eq('salon_id', salonId)
          .eq('role', role)
          .eq('resource', resource)
          .eq('action', action);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('salon_role_overrides').upsert(
          { salon_id: salonId, role, resource, action, granted },
          { onConflict: 'salon_id,role,resource,action' },
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salon_role_overrides', salonId] });
    },
    onError: toastOnError('Impossible de mettre à jour la permission'),
  });

  const resetRoleMutation = useMutation({
    mutationFn: async (role: EditableRole) => {
      const { error } = await supabase
        .from('salon_role_overrides')
        .delete()
        .eq('salon_id', salonId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salon_role_overrides', salonId] });
      toastOnSuccess('Permissions réinitialisées')();
    },
    onError: toastOnError('Impossible de réinitialiser le rôle'),
  });

  return {
    overrides,
    isLoading,
    setOverride: setOverrideMutation.mutate,
    isSettingOverride: setOverrideMutation.isPending,
    resetRole: resetRoleMutation.mutate,
    isResettingRole: resetRoleMutation.isPending,
  };
}
