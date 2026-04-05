import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toStaffMember, toStaffMemberInsert } from '../mappers';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { StaffMember } from '../../../types';

export const useTeam = (includeArchived = false) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const { toastOnError } = useMutationToast();
  useRealtimeSync('staff_members');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff_members', salonId, { includeArchived }],
    queryFn: async () => {
      let query = supabase
        .from('staff_members')
        .select('*')
        .eq('salon_id', salonId);
      if (!includeArchived) {
        query = query.is('deleted_at', null);
      }
      const { data, error } = await query.order('last_name');
      if (error) throw error;
      return (data ?? []).map(row => toStaffMember(row as unknown as Parameters<typeof toStaffMember>[0]));
    },
    enabled: !!salonId,
  });

  // Batch-fetch baseSalary for all staff via decrypted RPC (one call, not N)
  const staffIds = useMemo(() => staff.map(m => m.id), [staff]);

  const { data: salaryMap = {} as Record<string, number> } = useQuery({
    queryKey: ['staff_pii_batch', salonId, staffIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_staff_pii_batch', { p_staff_ids: staffIds });
      const map: Record<string, number> = {};
      if (error || !data) return map;
      for (const row of data as { staff_id: string; base_salary: string | null }[]) {
        if (row.base_salary != null) {
          map[row.staff_id] = parseFloat(row.base_salary);
        }
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
    enabled: staffIds.length > 0,
  });

  // Merge baseSalary into staff members
  const staffWithSalary = useMemo(() =>
    staff.map(m => {
      const salary = salaryMap[m.id];
      return salary !== undefined ? { ...m, baseSalary: salary } : m;
    }),
  [staff, salaryMap]);

  // Load PII fields for a specific staff member via decrypted RPC
  const loadStaffPii = async (staffId: string): Promise<Partial<StaffMember>> => {
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

  // Save PII fields via encrypted RPC (base_salary, iban, social_security_number)
  const savePiiFields = async (staffId: string, member: StaffMember) => {
    const { error } = await supabase.rpc('update_staff_pii', {
      p_staff_id: staffId,
      p_base_salary: member.baseSalary != null ? String(member.baseSalary) : null,
      p_iban: member.iban || null,
      p_social_security_number: member.socialSecurityNumber || null,
      p_clear_base_salary: member.baseSalary == null,
      p_clear_iban: !member.iban,
      p_clear_ssn: !member.socialSecurityNumber,
    });
    if (error) throw error;
  };

  const addStaffMemberMutation = useMutation({
    mutationFn: async (member: StaffMember) => {
      const insertData = toStaffMemberInsert(member, salonId);
      const { data, error } = await supabase
        .from('staff_members')
        .insert(insertData)
        .select('id')
        .single();
      if (error) throw error;
      try {
        await savePiiFields(data.id, member);
      } catch (piiError) {
        // Staff record was created but PII save failed — return the id
        // so user can navigate and retry PII via section edit
        console.warn('Staff created but PII save failed:', piiError);
        return { id: data.id, piiError: true };
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: toastOnError("Impossible d'ajouter le membre de l'équipe"),
  });

  const updateStaffMemberMutation = useMutation({
    mutationFn: async (member: StaffMember) => {
      const { id, salon_id, ...updateData } = toStaffMemberInsert(member, salonId);
      const { error } = await supabase
        .from('staff_members')
        .update(updateData)
        .eq('id', member.id)
        .eq('salon_id', salonId);
      if (error) throw error;
      await savePiiFields(member.id, member);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: toastOnError("Impossible de modifier le membre de l'équipe"),
  });

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return staffWithSalary;
    const term = searchTerm.toLowerCase();
    return staffWithSalary.filter(m =>
      m.firstName.toLowerCase().includes(term) ||
      m.lastName.toLowerCase().includes(term)
    );
  }, [staffWithSalary, searchTerm]);

  return {
    team: filteredStaff,
    allStaff: staffWithSalary,
    isLoading,
    searchTerm,
    setSearchTerm,
    loadStaffPii,
    addStaffMember: (member: StaffMember) => addStaffMemberMutation.mutateAsync(member),
    updateStaffMember: (member: StaffMember) => updateStaffMemberMutation.mutateAsync(member),
  };
};
