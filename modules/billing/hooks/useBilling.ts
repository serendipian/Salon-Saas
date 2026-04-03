// modules/billing/hooks/useBilling.ts
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import type { Subscription, SubscriptionTier } from '../../../lib/auth.types';

export const PLAN_LIMITS: Record<SubscriptionTier, { staff: number | null; clients: number | null; products: number | null }> = {
  trial:     { staff: 10,   clients: null, products: null },
  free:      { staff: 2,    clients: 50,   products: 20   },
  pro:       { staff: 10,   clients: null, products: null },
  enterprise:{ staff: null, clients: null, products: null },
  past_due:  { staff: 10,   clients: null, products: null },
};

export function useBilling() {
  const { activeSalon } = useAuth();
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

  const createCheckoutSession = async (planId: string) => {
    setIsLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { salon_id: activeSalon!.id, plan_id: planId },
      });
      if (error) throw error;
      window.location.href = data.url;
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const createPortalSession = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { salon_id: activeSalon!.id },
      });
      if (error) throw error;
      window.location.href = data.url;
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
