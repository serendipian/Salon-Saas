// modules/admin/hooks/useAdmin.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import { rawRpc } from '../../../lib/supabaseRaw';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminMRR {
  total_mrr: number | null;
  premium_count: number | null;
  pro_count: number | null;
  free_count: number | null;
  trial_count: number | null;
  past_due_count: number;
  total_salons: number | null;
}

export interface AdminAccount {
  id: string;
  name: string;
  slug: string | null;
  subscription_tier: string;
  is_suspended: boolean;
  created_at: string;
  staff_count: number;
  client_count: number;
  subscription_status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
}

export interface AdminAccountDetail extends AdminAccount {
  invoices: Array<{
    id: string;
    stripe_invoice_id: string;
    amount_cents: number;
    currency: string;
    status: string;
    hosted_invoice_url: string | null;
    invoice_pdf_url: string | null;
    paid_at: string;
  }>;
}

export interface AdminTrial {
  id: string;
  name: string;
  trial_ends_at: string;
  days_remaining: number;
}

export interface AdminFailedPayment {
  id: string;
  name: string;
  subscription_tier: string;
  current_period_end: string;
  stripe_subscription_id: string | null;
  days_overdue: number;
}

export interface AdminSignup {
  id: string;
  name: string;
  subscription_tier: string;
  created_at: string;
  staff_count: number;
}

export interface AdminChurn {
  id: string;
  name: string;
  cancelled_at: string;
}

export interface AdminHistoryPoint {
  month: string;
  value: number;
}

// ─── Read hooks ──────────────────────────────────────────────────────────────

export function useAdminMRR() {
  return useQuery<AdminMRR>({
    queryKey: ['admin', 'mrr'],
    queryFn: ({ signal }) => rawRpc<AdminMRR>('get_admin_mrr', {}, signal),
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminAccounts() {
  return useQuery<AdminAccount[]>({
    queryKey: ['admin', 'accounts'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<AdminAccount[] | null>('get_admin_accounts', {}, signal);
      return data ?? [];
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminAccount(salonId: string) {
  return useQuery<AdminAccountDetail>({
    queryKey: ['admin', 'account', salonId],
    queryFn: ({ signal }) =>
      rawRpc<AdminAccountDetail>('get_admin_account_detail', { p_salon_id: salonId }, signal),
    enabled: !!salonId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminTrials() {
  return useQuery<AdminTrial[]>({
    queryKey: ['admin', 'trials'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<AdminTrial[] | null>('get_admin_trials', {}, signal);
      return data ?? [];
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminFailedPayments() {
  return useQuery<AdminFailedPayment[]>({
    queryKey: ['admin', 'failed_payments'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<AdminFailedPayment[] | null>(
        'get_admin_failed_payments',
        {},
        signal,
      );
      return data ?? [];
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminRecentSignups() {
  return useQuery<AdminSignup[]>({
    queryKey: ['admin', 'recent_signups'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<AdminSignup[] | null>('get_admin_recent_signups', {}, signal);
      return data ?? [];
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminChurn() {
  return useQuery<AdminChurn[]>({
    queryKey: ['admin', 'churn'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<AdminChurn[] | null>('get_admin_churn', {}, signal);
      return data ?? [];
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminMRRHistory() {
  return useQuery<AdminHistoryPoint[]>({
    queryKey: ['admin', 'mrr_history'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<{ month: string; mrr: number }[] | null>(
        'get_admin_mrr_history',
        { months_back: 6 },
        signal,
      );
      return (data ?? []).map((d) => ({ month: d.month, value: Number(d.mrr) }));
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminSignupsHistory() {
  return useQuery<AdminHistoryPoint[]>({
    queryKey: ['admin', 'signups_history'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<{ month: string; count: number }[] | null>(
        'get_admin_signups_history',
        { months_back: 6 },
        signal,
      );
      return (data ?? []).map((d) => ({ month: d.month, value: Number(d.count) }));
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminTrialsHistory() {
  return useQuery<AdminHistoryPoint[]>({
    queryKey: ['admin', 'trials_history'],
    queryFn: async ({ signal }) => {
      const data = await rawRpc<{ month: string; count: number }[] | null>(
        'get_admin_trials_history',
        { months_back: 6 },
        signal,
      );
      return (data ?? []).map((d) => ({ month: d.month, value: Number(d.count) }));
    },
    staleTime: 60_000,
    retry: false,
  });
}

// ─── Write mutations ──────────────────────────────────────────────────────────

export function useAdminExtendTrial(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async (days: number) => {
      await rawRpc('admin_extend_trial', { p_salon_id: salonId, p_days: days });
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Essai prolongé avec succès.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'trials'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) =>
      addToast({
        type: 'error',
        message: (err as Error).message || 'Erreur lors de la prolongation.',
      }),
  });
}

export function useAdminSetPlan(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async (tier: string) => {
      await rawRpc('admin_set_plan', { p_salon_id: salonId, p_tier: tier });
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Plan mis à jour avec succès.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) =>
      addToast({
        type: 'error',
        message: (err as Error).message || 'Erreur lors du changement de plan.',
      }),
  });
}

export function useAdminSuspend(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      await rawRpc('admin_suspend_salon', { p_salon_id: salonId });
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Compte suspendu.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) =>
      addToast({
        type: 'error',
        message: (err as Error).message || 'Erreur lors de la suspension.',
      }),
  });
}

export function useAdminReactivate(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      await rawRpc('admin_reactivate_salon', { p_salon_id: salonId });
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Compte réactivé.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) =>
      addToast({
        type: 'error',
        message: (err as Error).message || 'Erreur lors de la réactivation.',
      }),
  });
}

export function useAdminCancelSubscription(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { error: fnError } = await supabase.functions.invoke('admin-cancel-subscription', {
        body: { salon_id: salonId },
      });
      if (fnError) throw fnError;
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        message: 'Abonnement annulé. Le salon passera en Free à la fin de la période.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed_payments'] });
    },
    onError: (err) =>
      addToast({
        type: 'error',
        message: (err as Error).message || "Erreur lors de l'annulation.",
      }),
  });
}
