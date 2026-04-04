// modules/admin/hooks/useAdmin.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminMRR {
  total_mrr: number;
  premium_count: number;
  pro_count: number;
  free_count: number;
  trial_count: number;
  past_due_count: number;
  total_salons: number;
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

// ─── Read hooks ──────────────────────────────────────────────────────────────

export function useAdminMRR() {
  return useQuery<AdminMRR>({
    queryKey: ['admin', 'mrr'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_mrr');
      if (error) throw error;
      return data as unknown as AdminMRR;
    },
  });
}

export function useAdminAccounts() {
  return useQuery<AdminAccount[]>({
    queryKey: ['admin', 'accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_accounts');
      if (error) throw error;
      return (data ?? []) as AdminAccount[];
    },
  });
}

export function useAdminAccount(salonId: string) {
  return useQuery<AdminAccountDetail>({
    queryKey: ['admin', 'account', salonId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_account_detail', { p_salon_id: salonId });
      if (error) throw error;
      return data as unknown as AdminAccountDetail;
    },
    enabled: !!salonId,
  });
}

export function useAdminTrials() {
  return useQuery<AdminTrial[]>({
    queryKey: ['admin', 'trials'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_trials');
      if (error) throw error;
      return (data ?? []) as AdminTrial[];
    },
  });
}

export function useAdminFailedPayments() {
  return useQuery<AdminFailedPayment[]>({
    queryKey: ['admin', 'failed_payments'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_failed_payments');
      if (error) throw error;
      return (data ?? []) as AdminFailedPayment[];
    },
  });
}

export function useAdminRecentSignups() {
  return useQuery<AdminSignup[]>({
    queryKey: ['admin', 'recent_signups'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_recent_signups');
      if (error) throw error;
      return (data ?? []) as AdminSignup[];
    },
  });
}

export function useAdminChurn() {
  return useQuery<AdminChurn[]>({
    queryKey: ['admin', 'churn'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_churn');
      if (error) throw error;
      return (data ?? []) as AdminChurn[];
    },
  });
}

// ─── Write mutations ──────────────────────────────────────────────────────────

export function useAdminExtendTrial(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase.rpc('admin_extend_trial', { p_salon_id: salonId, p_days: days });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Essai prolongé avec succès.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'trials'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors de la prolongation.' }),
  });
}

export function useAdminSetPlan(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async (tier: string) => {
      const { error } = await supabase.rpc('admin_set_plan', { p_salon_id: salonId, p_tier: tier });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Plan mis à jour avec succès.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors du changement de plan.' }),
  });
}

export function useAdminSuspend(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_suspend_salon', { p_salon_id: salonId });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Compte suspendu.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors de la suspension.' }),
  });
}

export function useAdminReactivate(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_reactivate_salon', { p_salon_id: salonId });
      if (error) throw error;
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Compte réactivé.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || 'Erreur lors de la réactivation.' }),
  });
}

export function useAdminCancelSubscription(salonId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd.session?.access_token;
      if (!token) throw new Error('Session expirée.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ salon_id: salonId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Abonnement annulé. Le salon passera en Free à la fin de la période.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'account', salonId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed_payments'] });
    },
    onError: (err) => addToast({ type: 'error', message: (err as Error).message || "Erreur lors de l'annulation." }),
  });
}
