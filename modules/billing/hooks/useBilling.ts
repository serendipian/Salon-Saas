// modules/billing/hooks/useBilling.ts
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import type { Subscription, SubscriptionTier } from '../../../lib/auth.types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const PLAN_LIMITS: Record<SubscriptionTier, { staff: number | null; clients: number | null; products: number | null }> = {
  trial:     { staff: 10,   clients: null, products: null },
  free:      { staff: 2,    clients: 50,   products: 20   },
  pro:       { staff: 10,   clients: null, products: null },
  enterprise:{ staff: null, clients: null, products: null },
  past_due:  { staff: 10,   clients: null, products: null },
};

export function useBilling() {
  const { activeSalon, session } = useAuth();
  const { addToast } = useToast();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ['subscription', activeSalon?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('salon_id', activeSalon!.id)
        .single();
      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!activeSalon,
  });

  const tier: SubscriptionTier = (activeSalon?.subscription_tier as SubscriptionTier) ?? 'free';
  const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

  const canAddStaff = (currentCount: number) =>
    limits.staff === null || currentCount < limits.staff;

  const canAddClient = (currentCount: number) =>
    limits.clients === null || currentCount < limits.clients;

  const canAddProduct = (currentCount: number) =>
    limits.products === null || currentCount < limits.products;

  const invokeWithErrorHandling = async (fnName: string, body: object): Promise<{ url: string } | null> => {
    // Always get a fresh token (triggers refresh if expired)
    const { data: sd } = await supabase.auth.getSession();
    const token = sd.session?.access_token ?? session?.access_token;
    if (!token) throw new Error('Session expirée. Veuillez vous reconnecter.');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const createCheckoutSession = async (planId: string) => {
    setIsLoadingCheckout(true);
    try {
      const data = await invokeWithErrorHandling('create-checkout-session', {
        salon_id: activeSalon!.id, plan_id: planId,
      });
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      addToast({ type: 'error', message: (err as Error).message || 'Erreur lors de la création du paiement.' });
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const createPortalSession = async () => {
    setIsLoadingPortal(true);
    try {
      const data = await invokeWithErrorHandling('create-portal-session', { salon_id: activeSalon!.id });
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      addToast({ type: 'error', message: (err as Error).message || "Erreur lors de l'ouverture du portail." });
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil(
        (new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : null;

  return {
    subscription,
    isLoading,
    tier,
    limits,
    trialDaysLeft,
    canAddStaff,
    canAddClient,
    canAddProduct,
    createCheckoutSession,
    createPortalSession,
    isLoadingCheckout,
    isLoadingPortal,
  };
}
