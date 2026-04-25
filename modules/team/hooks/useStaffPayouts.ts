import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import { rawInsert, rawSelect, rawUpdate } from '../../../lib/supabaseRaw';
import type { PayoutType, StaffPayout } from '../../../types';

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
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('staff_id', `eq.${staffId}`);
      params.append('salon_id', `eq.${salonId!}`);
      params.append('deleted_at', 'is.null');
      params.append('order', 'period_start.desc');
      const data = await rawSelect<any>('staff_payouts', params.toString(), signal);
      return data.map(toStaffPayout);
    },
    enabled: !!salonId && !!staffId,
  });

  const addPayoutMutation = useMutation({
    mutationFn: async (input: CreatePayoutInput) => {
      // DB unique index on (staff_id, type, period_start, period_end) WHERE non-cancelled
      // enforces duplicates — no client-side check needed (caught via onError)
      await rawInsert('staff_payouts', {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
    },
    onError: toastOnError("Erreur lors de l'enregistrement"),
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${payoutId}`);
      params.append('salon_id', `eq.${salonId!}`);
      params.append('status', 'eq.PENDING');
      await rawUpdate('staff_payouts', params.toString(), {
        status: 'PAID',
        paid_at: new Date().toISOString(),
        updated_by: profile?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payouts', salonId, staffId] });
    },
    onError: toastOnError('Erreur lors de la mise à jour'),
  });

  const cancelPayoutMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const params = new URLSearchParams();
      params.append('id', `eq.${payoutId}`);
      params.append('salon_id', `eq.${salonId!}`);
      params.append('status', 'eq.PENDING');
      await rawUpdate('staff_payouts', params.toString(), {
        status: 'CANCELLED',
        updated_by: profile?.id,
      });
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
