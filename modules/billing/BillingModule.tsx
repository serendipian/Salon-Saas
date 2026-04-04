// modules/billing/BillingModule.tsx
import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from './hooks/useBilling';
import { TrialBanner } from './components/TrialBanner';
import { CurrentPlanCard } from './components/CurrentPlanCard';
import { PlanCards } from './components/PlanCards';
import { StripePortalSection } from './components/StripePortalSection';
import { UpgradeModal } from './components/UpgradeModal';
import { UpgradeSuccess } from './components/UpgradeSuccess';

interface BillingModuleProps {
  onBack: () => void;
}

export const BillingModule: React.FC<BillingModuleProps> = ({ onBack }) => {
  const { activeSalon } = useAuth();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';
  const successPlanName = searchParams.get('plan') ?? undefined;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const {
    subscription, tier, limits, trialDaysLeft,
    createCheckoutSession, createPortalSession,
    isLoadingCheckout, isLoadingPortal,
  } = useBilling();

  // Load plans from DB
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('active', true)
        .order('price_monthly', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Load current usage counts
  const { data: usage = { staff: 0, clients: 0, products: 0 } } = useQuery({
    queryKey: ['salon-usage', activeSalon?.id],
    queryFn: async () => {
      const [staffRes, clientsRes, productsRes] = await Promise.all([
        supabase.from('staff_members').select('id', { count: 'exact', head: true })
          .eq('salon_id', activeSalon!.id).is('deleted_at', null),
        supabase.from('clients').select('id', { count: 'exact', head: true })
          .eq('salon_id', activeSalon!.id).is('deleted_at', null),
        supabase.from('products').select('id', { count: 'exact', head: true })
          .eq('salon_id', activeSalon!.id).is('deleted_at', null),
      ]);
      return {
        staff: staffRes.count ?? 0,
        clients: clientsRes.count ?? 0,
        products: productsRes.count ?? 0,
      };
    },
    enabled: !!activeSalon,
  });

  // Find Premium plan for upgrade modal
  const premiumPlan = plans.find(p => p.name === 'Premium');

  const handleUpgradeFromModal = async () => {
    if (premiumPlan) await createCheckoutSession(premiumPlan.id);
  };

  if (isSuccess) {
    return (
      <div className="w-full py-8 px-4 animate-in fade-in duration-500">
        <UpgradeSuccess planName={successPlanName} />
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      {/* Trial banner */}
      {tier === 'trial' && trialDaysLeft !== null && (
        <div className="-mx-6 -mt-6 mb-6">
          <TrialBanner
            daysLeft={trialDaysLeft}
            onUpgradeClick={() => setShowUpgradeModal(true)}
          />
        </div>
      )}

      {/* Back + title */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Abonnement & Facturation</h1>
          <p className="text-sm text-slate-500">Gérez votre plan et votre facturation</p>
        </div>
      </div>

      <div className="space-y-6">
        <CurrentPlanCard
          subscription={subscription}
          tier={tier}
          limits={limits}
          staffCount={usage.staff}
          clientCount={usage.clients}
          productCount={usage.products}
          onManageBilling={createPortalSession}
          isLoadingPortal={isLoadingPortal}
        />

        <PlanCards
          plans={plans}
          currentTier={tier}
          onSelectPlan={createCheckoutSession}
          onDowngrade={createPortalSession}
          isLoading={isLoadingCheckout}
        />

        {tier !== 'trial' && tier !== 'free' && (
          <StripePortalSection
            onOpenPortal={createPortalSession}
            isLoading={isLoadingPortal}
          />
        )}
      </div>

      {showUpgradeModal && premiumPlan && (
        <UpgradeModal
          resource="staff"
          priceMonthly={premiumPlan?.price_monthly ?? 0}
          onUpgrade={handleUpgradeFromModal}
          onClose={() => setShowUpgradeModal(false)}
          isLoading={isLoadingCheckout}
        />
      )}
    </div>
  );
};
