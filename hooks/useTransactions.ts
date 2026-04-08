// hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toTransaction, toTransactionRpcPayload, TransactionRow } from '../modules/pos/mappers';
import type { CartItem, PaymentEntry } from '../types';
import { useRealtimeSync } from './useRealtimeSync';
import { useMutationToast } from './useMutationToast';

export interface TransactionQueryOptions {
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

export const useTransactions = (options?: TransactionQueryOptions) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError } = useMutationToast();
  useRealtimeSync('transactions');

  const from = options?.from;
  const to = options?.to;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', salonId, from ?? 'all', to ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, transaction_items(*), transaction_payments(*), clients(first_name, last_name)')
        .eq('salon_id', salonId)
        .order('date', { ascending: false });

      if (from) query = query.gte('date', from);
      if (to) query = query.lte('date', to);

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as TransactionRow[]).map(toTransaction);
    },
    enabled: !!salonId,
  });

  const addTransactionMutation = useMutation({
    mutationFn: async ({
      items,
      payments,
      clientId,
      appointmentId,
    }: {
      items: CartItem[];
      payments: PaymentEntry[];
      clientId?: string;
      appointmentId?: string;
    }) => {
      const payload = toTransactionRpcPayload(items, payments, clientId, salonId, appointmentId);

      // Timeout after 30s to prevent indefinite hang (network issues, auth lock deadlock)
      const rpcPromise = supabase.rpc('create_transaction', payload);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('La transaction a expiré (30s). Vérifiez votre connexion et réessayez.')), 30_000)
      );
      const { error } = await Promise.race([rpcPromise, timeoutPromise]);
      if (error) throw error;
    },
    onSuccess: () => {
      // Prefix match: invalidates ALL ['transactions', salonId, ...] regardless of date params
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
      queryClient.invalidateQueries({ queryKey: ['appointments', salonId] });
      // Also invalidate new client count since a new transaction could change the metric
      queryClient.invalidateQueries({ queryKey: ['new_client_count', salonId] });
    },
    onError: toastOnError("Impossible de créer la transaction"),
  });

  const voidMutation = useMutation({
    mutationFn: async ({
      transactionId,
      reasonCategory,
      reasonNote,
    }: {
      transactionId: string;
      reasonCategory: string;
      reasonNote: string;
    }) => {
      const { error } = await supabase.rpc('void_transaction', {
        p_transaction_id: transactionId,
        p_salon_id: salonId,
        p_reason_category: reasonCategory,
        p_reason_note: reasonNote,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: toastOnError("Impossible d'annuler la transaction"),
  });

  const refundMutation = useMutation({
    mutationFn: async ({
      transactionId,
      items,
      payments,
      reasonCategory,
      reasonNote,
      restock,
    }: {
      transactionId: string;
      items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[];
      payments: { method: string; amount: number }[];
      reasonCategory: string;
      reasonNote: string;
      restock: boolean;
    }) => {
      const { error } = await supabase.rpc('refund_transaction', {
        p_transaction_id: transactionId,
        p_salon_id: salonId,
        p_items: items,
        p_payments: payments,
        p_reason_category: reasonCategory,
        p_reason_note: reasonNote,
        p_restock: restock,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: toastOnError('Impossible de rembourser la transaction'),
  });

  const addTransaction = (items: CartItem[], payments: PaymentEntry[], clientId?: string, appointmentId?: string) =>
    addTransactionMutation.mutateAsync({ items, payments, clientId, appointmentId });

  const voidTransaction = (transactionId: string, reasonCategory: string, reasonNote: string) =>
    voidMutation.mutateAsync({ transactionId, reasonCategory, reasonNote });

  const refundTransaction = (
    transactionId: string,
    items: { original_item_id: string | null; quantity: number; price_override?: number; price?: number; name?: string }[],
    payments: { method: string; amount: number }[],
    reasonCategory: string,
    reasonNote: string,
    restock: boolean
  ) => refundMutation.mutateAsync({ transactionId, items, payments, reasonCategory, reasonNote, restock });

  return {
    transactions,
    isLoading,
    addTransaction,
    voidTransaction,
    refundTransaction,
    isVoiding: voidMutation.isPending,
    isRefunding: refundMutation.isPending,
  };
};
