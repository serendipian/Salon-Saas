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
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['staff_payouts', salonId, staffId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('staff_payouts' as any)
        .select('*')
        .eq('staff_id', staffId)
        .eq('salon_id', salonId!)
        .is('deleted_at', null)
        .order('period_start', { ascending: false }) as any);
      if (error) throw error;
      return (data || []).map(toStaffPayout);
    },
    enabled: !!salonId && !!staffId,
  });

  const addPayoutMutation = useMutation({
    mutationFn: async (input: CreatePayoutInput) => {
      const { error } = await (supabase.from('staff_payouts' as any).insert({
        salon_id: salonId!,
        staff_id: staffId,
        type: input.type,
        amount: input.amount,
        reference_amount: input.referenceAmount,
        rate_snapshot: input.rateSnapshot,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        notes: input.notes,
      }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
    },
    onError: toastOnError("Erreur lors de l'enregistrement"),
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await (supabase
        .from('staff_payouts' as any)
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('id', payoutId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  const cancelPayoutMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await (supabase
        .from('staff_payouts' as any)
        .update({ status: 'CANCELLED' })
        .eq('id', payoutId) as any);
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
