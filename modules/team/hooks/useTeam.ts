import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toStaffMember, toStaffMemberInsert } from '../mappers';
import type { StaffMember } from '../../../types';

export const useTeam = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff_members', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('salon_id', salonId)
        .is('deleted_at', null)
        .order('last_name');
      if (error) throw error;
      return (data ?? []).map(toStaffMember);
    },
    enabled: !!salonId,
  });

  const addStaffMemberMutation = useMutation({
    mutationFn: async (member: StaffMember) => {
      const { error } = await supabase
        .from('staff_members')
        .insert(toStaffMemberInsert(member, salonId));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: (error) => console.error('Failed to add staff member:', error.message),
  });

  const updateStaffMemberMutation = useMutation({
    mutationFn: async (member: StaffMember) => {
      const { id, salon_id, ...updateData } = toStaffMemberInsert(member, salonId);
      const { error } = await supabase
        .from('staff_members')
        .update(updateData)
        .eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members', salonId] });
    },
    onError: (error) => console.error('Failed to update staff member:', error.message),
  });

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return staff;
    const term = searchTerm.toLowerCase();
    return staff.filter(m =>
      m.firstName.toLowerCase().includes(term) ||
      m.lastName.toLowerCase().includes(term)
    );
  }, [staff, searchTerm]);

  return {
    team: filteredStaff,
    allStaff: staff,
    isLoading,
    searchTerm,
    setSearchTerm,
    addStaffMember: (member: StaffMember) => addStaffMemberMutation.mutate(member),
    updateStaffMember: (member: StaffMember) => updateStaffMemberMutation.mutate(member),
  };
};
