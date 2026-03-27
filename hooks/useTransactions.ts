// hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toTransaction, toTransactionRpcPayload, TransactionRow } from '../modules/pos/mappers';
import type { CartItem, PaymentEntry } from '../types';
import { useRealtimeSync } from './useRealtimeSync';

export const useTransactions = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  useRealtimeSync('transactions');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*), transaction_payments(*), clients(first_name, last_name)')
        .eq('salon_id', salonId)
        .order('date', { ascending: false });
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
    }: {
      items: CartItem[];
      payments: PaymentEntry[];
      clientId?: string;
    }) => {
      const payload = toTransactionRpcPayload(items, payments, clientId, salonId);
      const { error } = await supabase.rpc('create_transaction', payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', salonId] });
      // RPC decrements product stock, so invalidate products too
      queryClient.invalidateQueries({ queryKey: ['products', salonId] });
    },
    onError: (error: Error) => {
      // Map known RPC exceptions to French UI messages
      if (error.message.includes('Payment total') && error.message.includes('does not match')) {
        console.error('Le total des paiements ne correspond pas au montant de la transaction.');
      } else if (error.message.includes('do not have permission')) {
        console.error("Vous n'avez pas la permission de créer des transactions.");
      } else {
        console.error('Transaction error:', error.message);
      }
    },
  });

  const addTransaction = (items: CartItem[], payments: PaymentEntry[], clientId?: string) =>
    addTransactionMutation.mutateAsync({ items, payments, clientId });

  return {
    transactions,
    isLoading,
    addTransaction,
  };
};
