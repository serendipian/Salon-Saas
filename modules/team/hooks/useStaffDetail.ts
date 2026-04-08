import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toStaffMember, toStaffMemberInsert } from '../mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { StaffMember } from '../../../types';

export const useStaffDetail = (slug: string) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();

  useRealtimeSync('staff_members');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff_member', salonId, slug],
    queryFn: async () => {
      // Prefer active record when slug collides with an archived duplicate
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('slug', slug)
        .eq('salon_id', salonId)
        .order('deleted_at', { ascending: true, nullsFirst: true })
        .limit(1)
        .single();
      if (error) throw error;
      return toStaffMember(data as unknown as Parameters<typeof toStaffMember>[0]);
    },
    enabled: !!salonId && !!slug,
  });

  // Resolved ID for mutations
  const staffId = staff?.id ?? '';

  // Load PII fields for this staff member via decrypted RPC
  const loadPii = async (): Promise<Partial<StaffMember>> => {
    const { data, error } = await supabase.rpc('get_staff_pii', { p_staff_id: staffId });
    if (error) throw error;
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
    const { error } = await supabase.rpc('update_staff_pii', {
      p_staff_id: id,
      p_base_salary: member.baseSalary != null ? String(member.baseSalary) : null,
      p_iban: member.iban || null,
      p_social_security_number: member.socialSecurityNumber || null,
      p_clear_base_salary: member.baseSalary == null,
      p_clear_iban: !member.iban,
      p_clear_ssn: !member.socialSecurityNumber,
    });
    if (error) throw error;
  };

  const updateSectionMutation = useMutation({
    mutationFn: async (updates: Partial<StaffMember>) => {
      if (!staff) throw new Error('Staff data not loaded');
      const hasPii = 'baseSalary' in updates || 'iban' in updates || 'socialSecurityNumber' in updates;

      // Separate PII from non-PII fields
      const { baseSalary, iban, socialSecurityNumber, ...rest } = updates;
      if (Object.keys(rest).length > 0) {
        const current = staff;
        const merged = { ...current, ...rest };
        const { id: _id, salon_id: _sid, ...updatePayload } = toStaffMemberInsert(merged, salonId);
        const { error } = await supabase
          .from('staff_members')
          .update(updatePayload)
          .eq('id', staffId)
          .eq('salon_id', salonId);
        if (error) throw error;
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
        const { error } = await supabase.rpc('revoke_membership', {
          p_membership_id: staff.membershipId,
        });
        if (error) throw error;
      } else {
        // Ghost staff: direct soft delete
        const { error } = await supabase
          .from('staff_members')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', staffId)
          .eq('salon_id', salonId);
        if (error) throw error;
      }

      // Cancel pending invitations
      await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('staff_member_id', staffId)
        .eq('salon_id', salonId)
        .is('accepted_at', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: toastOnError("Erreur lors de l'archivage"),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('staff_members')
        .update({ deleted_at: null, active: true })
        .eq('id', staffId)
        .eq('salon_id', salonId);
      if (error) throw error;
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
