import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { rawRpc, rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { StaffMember } from '../../../types';
import { toStaffMember, toStaffMemberInsert } from '../mappers';

export const useStaffDetail = (slug: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();

  useRealtimeSync('staff_members');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff_member', salonId, slug],
    queryFn: async ({ signal }) => {
      // Prefer active record when slug collides with an archived duplicate
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('slug', `eq.${slug}`);
      params.append('salon_id', `eq.${salonId}`);
      params.append('order', 'deleted_at.asc.nullsfirst');
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
    enabled: !!salonId && !!slug,
  });

  // Resolved ID for mutations
  const staffId = staff?.id ?? '';

  // Load PII fields for this staff member via decrypted RPC
  const loadPii = async (): Promise<Partial<StaffMember>> => {
    const data = await rawRpc<
      | { base_salary: string | null; iban: string | null; social_security_number: string | null }[]
      | { base_salary: string | null; iban: string | null; social_security_number: string | null }
      | null
    >('get_staff_pii', { p_staff_id: staffId });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return {};
    return {
      baseSalary: row.base_salary != null ? parseFloat(row.base_salary) : undefined,
      iban: row.iban ?? undefined,
      socialSecurityNumber: row.social_security_number ?? undefined,
    };
  };

  // Save PII fields via encrypted RPC
  const savePiiFields = async (id: string, member: Partial<StaffMember>) => {
    await rawRpc('update_staff_pii', {
      p_staff_id: id,
      p_base_salary: member.baseSalary != null ? String(member.baseSalary) : undefined,
      p_iban: member.iban || undefined,
      p_social_security_number: member.socialSecurityNumber || undefined,
      p_clear_base_salary: member.baseSalary == null,
      p_clear_iban: !member.iban,
      p_clear_ssn: !member.socialSecurityNumber,
    });
  };

  const updateSectionMutation = useMutation({
    mutationFn: async (updates: Partial<StaffMember>) => {
      if (!staff) throw new Error('Staff data not loaded');
      const hasPii =
        'baseSalary' in updates || 'iban' in updates || 'socialSecurityNumber' in updates;

      // Separate PII from non-PII fields
      const { baseSalary, iban, socialSecurityNumber, ...rest } = updates;
      if (Object.keys(rest).length > 0) {
        const current = staff;
        const merged = { ...current, ...rest };
        const { id: _id, salon_id: _sid, ...updatePayload } = toStaffMemberInsert(merged, salonId);
        const params = new URLSearchParams();
        params.append('id', `eq.${staffId}`);
        params.append('salon_id', `eq.${salonId}`);
        await rawUpdate('staff_members', params.toString(), updatePayload);
      }

      // PII fields via RPC
      if (hasPii) {
        await savePiiFields(staffId, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_member', salonId, slug] });
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (staff?.membershipId) {
        // Linked staff: revoke membership (atomically deletes membership + staff)
        await rawRpc('revoke_membership', { p_membership_id: staff.membershipId });
      } else {
        // Ghost staff: direct soft delete
        const params = new URLSearchParams();
        params.append('id', `eq.${staffId}`);
        params.append('salon_id', `eq.${salonId}`);
        await rawUpdate('staff_members', params.toString(), {
          deleted_at: new Date().toISOString(),
        });
      }

      // Cancel pending invitations
      const invParams = new URLSearchParams();
      invParams.append('staff_member_id', `eq.${staffId}`);
      invParams.append('salon_id', `eq.${salonId}`);
      invParams.append('accepted_at', 'is.null');
      await rawUpdate('invitations', invParams.toString(), {
        expires_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: toastOnError("Erreur lors de l'archivage"),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      params.append('id', `eq.${staffId}`);
      params.append('salon_id', `eq.${salonId}`);
      await rawUpdate('staff_members', params.toString(), {
        deleted_at: null,
        active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_member', salonId, slug] });
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: toastOnError('Erreur lors de la restauration'),
  });

  return {
    staff,
    isLoading,
    isArchived: !!staff?.deletedAt,
    loadPii,
    updateSection: (updates: Partial<StaffMember>) => updateSectionMutation.mutateAsync(updates),
    isUpdating: updateSectionMutation.isPending,
    archive: () => archiveMutation.mutateAsync(),
    restore: () => restoreMutation.mutateAsync(),
  };
};
