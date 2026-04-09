import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { Role } from '../../../lib/auth.types';

/** Number of days before a generated invitation link expires. */
export const INVITATION_EXPIRY_DAYS = 7;

export interface MemberRow {
  id: string;
  role: Role;
  status: string;
  created_at: string;
  accepted_at: string | null;
  profile_id: string;
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface InvitationRow {
  id: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  staff_member_id: string | null;
}

const STAFF_ROLE_MAP: Record<string, string> = {
  owner: 'Manager',
  manager: 'Manager',
  stylist: 'Stylist',
  receptionist: 'Receptionist',
};

export function useTeamSettings() {
  const { activeSalon, profile, role: currentUserRole } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  // --- Queries ---

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-settings-members', salonId],
    queryFn: async (): Promise<MemberRow[]> => {
      // Disambiguate the profiles join via the FK name — salon_memberships
      // has two FKs to profiles (profile_id and invited_by) so Supabase
      // requires an explicit hint. `!salon_memberships_profile_id_fkey`
      // tells PostgREST which relationship to embed.
      const { data, error } = await supabase
        .from('salon_memberships')
        .select('id, role, status, created_at, accepted_at, profile_id, profile:profiles!salon_memberships_profile_id_fkey(id, first_name, last_name, email, avatar_url)')
        .eq('salon_id', salonId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Supabase returns the embedded row as either a single object or array
      // depending on FK cardinality inference. Normalize and drop rows with
      // no joined profile (shouldn't happen in practice given the FK).
      type JoinedRow = Omit<MemberRow, 'profile' | 'role'> & {
        role: string;
        profile: MemberRow['profile'] | MemberRow['profile'][] | null;
      };
      return ((data as unknown as JoinedRow[] | null) ?? []).flatMap((row) => {
        const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
        if (!profile) return [];
        return [{
          id: row.id,
          role: row.role as Role,
          status: row.status,
          created_at: row.created_at,
          accepted_at: row.accepted_at,
          profile_id: row.profile_id,
          profile,
        }];
      });
    },
    enabled: !!salonId,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['team-settings-invitations', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, role, token, created_at, expires_at, accepted_at, staff_member_id')
        .eq('salon_id', salonId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InvitationRow[];
    },
    enabled: !!salonId,
  });

  // --- Mutations ---

  const changeRoleMutation = useMutation({
    mutationFn: async ({ membershipId, newRole }: { membershipId: string; newRole: Role }) => {
      const { error: membershipError } = await supabase
        .from('salon_memberships')
        .update({ role: newRole })
        .eq('id', membershipId)
        .eq('salon_id', salonId!);
      if (membershipError) throw membershipError;

      const { error: staffError } = await supabase
        .from('staff_members')
        .update({ role: STAFF_ROLE_MAP[newRole] || 'Stylist' })
        .eq('membership_id', membershipId)
        .eq('salon_id', salonId!)
        .is('deleted_at', null);
      if (staffError) throw staffError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-members', salonId] });
      // Also invalidate staff_members — role change writes to both tables, and
      // team/appointments modules query staff_members directly.
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
      toastOnSuccess('Rôle mis à jour')();
    },
    onError: toastOnError('Erreur lors du changement de rôle'),
  });

  const revokeMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.rpc('revoke_membership', { p_membership_id: membershipId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-members', salonId] });
      toastOnSuccess('Accès révoqué')();
    },
    onError: toastOnError('Impossible de retirer ce membre'),
  });

  const transferMutation = useMutation({
    mutationFn: async (newOwnerProfileId: string) => {
      const { error } = await supabase.rpc('transfer_ownership', {
        p_salon_id: salonId!,
        p_new_owner_id: newOwnerProfileId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-members', salonId] });
      toastOnSuccess('Propriété transférée')();
      window.location.reload();
    },
    onError: toastOnError('Impossible de transférer la propriété'),
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (role: string) => {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          salon_id: salonId!,
          role,
          token,
          invited_by: profile!.id,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();
      if (error) throw error;
      return data.token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-invitations', salonId] });
    },
    onError: toastOnError("Erreur lors de la création de l'invitation"),
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', invitationId)
        .eq('salon_id', salonId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-invitations', salonId] });
      toastOnSuccess('Invitation annulée')();
    },
    onError: toastOnError("Erreur lors de l'annulation"),
  });

  return {
    members,
    invitations,
    membersLoading,
    invitationsLoading,
    currentUserRole,
    currentUserId: profile?.id,
    changeRole: (membershipId: string, newRole: Role) =>
      changeRoleMutation.mutateAsync({ membershipId, newRole }),
    isChangingRole: changeRoleMutation.isPending,
    revokeMember: (membershipId: string) => revokeMutation.mutateAsync(membershipId),
    isRevoking: revokeMutation.isPending,
    transferOwnership: (newOwnerProfileId: string) => transferMutation.mutateAsync(newOwnerProfileId),
    isTransferring: transferMutation.isPending,
    createInvitation: (role: string) => createInvitationMutation.mutateAsync(role),
    isCreatingInvitation: createInvitationMutation.isPending,
    cancelInvitation: (id: string) => cancelInvitationMutation.mutateAsync(id),
    isCancellingInvitation: cancelInvitationMutation.isPending,
  };
}
