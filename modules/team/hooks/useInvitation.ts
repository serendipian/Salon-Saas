import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { rawInsertReturning, rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { StaffMember } from '../../../types';

const ROLE_MAP: Record<StaffMember['role'], string> = {
  Manager: 'manager',
  Stylist: 'stylist',
  Receptionist: 'receptionist',
  Assistant: 'receptionist',
};

interface InvitationRow {
  id: string;
  salon_id: string;
  staff_member_id: string;
  role: string;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export const useInvitation = (staffId: string) => {
  const { activeSalon, profile } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();

  const { data: invitation } = useQuery({
    queryKey: ['invitation', salonId, staffId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('staff_member_id', `eq.${staffId}`);
      params.append('salon_id', `eq.${salonId!}`);
      params.append('accepted_at', 'is.null');
      params.append('expires_at', `gt.${new Date().toISOString()}`);
      params.append('order', 'created_at.desc');
      params.append('limit', '1');
      const data = await rawSelect<InvitationRow>('invitations', params.toString(), signal);
      return data[0] ?? null;
    },
    enabled: !!salonId && !!staffId,
  });

  const createMutation = useMutation({
    mutationFn: async (role: string) => {
      // Expire existing pending invitations for this staff
      const expireParams = new URLSearchParams();
      expireParams.append('salon_id', `eq.${salonId!}`);
      expireParams.append('staff_member_id', `eq.${staffId}`);
      expireParams.append('accepted_at', 'is.null');
      await rawUpdate('invitations', expireParams.toString(), {
        expires_at: new Date().toISOString(),
      });

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const inserted = await rawInsertReturning<{ token: string }>(
        'invitations',
        {
          salon_id: salonId!,
          role: ROLE_MAP[role as StaffMember['role']] || 'stylist',
          token,
          invited_by: profile!.id,
          expires_at: expiresAt.toISOString(),
          staff_member_id: staffId,
        },
        'token',
      );
      const returnedToken = inserted[0]?.token;
      if (!returnedToken) throw new Error('Invitation insert returned no token');
      return returnedToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation', salonId, staffId] });
    },
    onError: toastOnError("Erreur lors de la création de l'invitation"),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!invitation) return;
      const params = new URLSearchParams();
      params.append('id', `eq.${invitation.id}`);
      params.append('salon_id', `eq.${salonId!}`);
      await rawUpdate('invitations', params.toString(), {
        expires_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation', salonId, staffId] });
    },
    onError: toastOnError("Erreur lors de l'annulation de l'invitation"),
  });

  return {
    invitation,
    createInvitation: async (role: string = 'Stylist') => {
      return await createMutation.mutateAsync(role);
    },
    cancelInvitation: () => cancelMutation.mutateAsync(),
    isCancelling: cancelMutation.isPending,
  };
};
