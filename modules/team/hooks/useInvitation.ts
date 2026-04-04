import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';

const ROLE_MAP: Record<string, string> = {
  Manager: 'manager',
  Stylist: 'stylist',
  Receptionist: 'receptionist',
  Assistant: 'receptionist',
};

export const useInvitation = (staffId: string) => {
  const { activeSalon, profile } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();

  const { data: invitation } = useQuery({
    queryKey: ['invitation', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('staff_member_id', staffId)
        .eq('salon_id', salonId!)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!salonId && !!staffId,
  });

  const createMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      // Expire existing pending invitations for this staff
      await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('staff_member_id', staffId)
        .eq('salon_id', salonId!)
        .is('accepted_at', null);

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          salon_id: salonId!,
          email,
          role: ROLE_MAP[role] || 'stylist',
          token,
          invited_by: profile!.id,
          expires_at: expiresAt.toISOString(),
          staff_member_id: staffId,
        })
        .select('token')
        .single();

      if (error) throw error;
      return data.token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation', salonId, staffId] });
    },
    onError: toastOnError('Erreur lors de la création de l\'invitation'),
  });

  return {
    invitation,
    createInvitation: async (email: string, role: string = 'Stylist') => {
      return await createMutation.mutateAsync({ email, role });
    },
    cancelInvitation: async () => {
      if (!invitation) return;
      await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', invitation.id);
      queryClient.invalidateQueries({ queryKey: ['invitation', salonId, staffId] });
    },
  };
};
