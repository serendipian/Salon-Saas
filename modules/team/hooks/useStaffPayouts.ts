import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { StaffPayout, PayoutType } from '../../../types';

export interface CreatePayoutInput {
  type: PayoutType;
  amount: number;
  referenceAmount?: number;
  rateSnapshot?: number;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

function toStaffPayout(row: any): StaffPayout {
  return {
    id: row.id,
    salonId: row.salon_id,
    staffId: row.staff_id,
    type: row.type,
    status: row.status,
    amount: parseFloat(row.amount),
    referenceAmount: row.reference_amount ? parseFloat(row.reference_amount) : undefined,
    rateSnapshot: row.rate_snapshot ? parseFloat(row.rate_snapshot) : undefined,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    paidAt: row.paid_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export const useStaffPayouts = (staffId: string) => {
  const { activeSalon, profile } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['staff_payouts', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_payouts')
        .select('*')
        .eq('staff_id', staffId)
        .eq('salon_id', salonId!)
        .is('deleted_at', null)
        .order('period_start', { ascending: false });
      if (error) throw error;
      return (data || []).map(toStaffPayout);
    },
    enabled: !!salonId && !!staffId,
  });

  const addPayoutMutation = useMutation({
    mutationFn: async (input: CreatePayoutInput) => {
      // Check for duplicate payout (same type + overlapping period, non-cancelled)
      const { data: existing } = await supabase
        .from('staff_payouts')
        .select('id')
        .eq('staff_id', staffId)
        .eq('salon_id', salonId!)
        .eq('type', input.type)
        .eq('period_start', input.periodStart)
        .eq('period_end', input.periodEnd)
        .neq('status', 'CANCELLED')
        .is('deleted_at', null)
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error('Un paiement existe déjà pour cette période et ce type');
      }
      const { error } = await supabase.from('staff_payouts').insert({
        salon_id: salonId!,
        staff_id: staffId,
        type: input.type,
        amount: input.amount,
        reference_amount: input.referenceAmount,
        rate_snapshot: input.rateSnapshot,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        notes: input.notes,
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
    },
    onError: toastOnError("Erreur lors de l'enregistrement"),
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase
        .from('staff_payouts')
        .update({ status: 'PAID', paid_at: new Date().toISOString(), updated_by: profile?.id })
        .eq('id', payoutId)
        .eq('salon_id', salonId!)
        .eq('status', 'PENDING');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  const cancelPayoutMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase
        .from('staff_payouts')
        .update({ status: 'CANCELLED', updated_by: profile?.id })
        .eq('id', payoutId)
        .eq('salon_id', salonId!)
        .eq('status', 'PENDING');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
    },
    onError: toastOnError("Erreur lors de l'annulation"),
  });

  return {
    payouts,
    isLoading,
    addPayout: (input: CreatePayoutInput) => addPayoutMutation.mutateAsync(input),
    markAsPaid: (id: string) => markAsPaidMutation.mutateAsync(id),
    cancelPayout: (id: string) => cancelPayoutMutation.mutateAsync(id),
  };
};
