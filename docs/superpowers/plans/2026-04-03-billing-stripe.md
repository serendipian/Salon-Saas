# Billing & Stripe Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Stripe subscription billing system — DB schema, 4 Edge Functions, and full billing UI inside Settings — so salon owners can subscribe, upgrade, and manage invoices.

**Architecture:** DB-first (migrations → RPC → types → hook → UI). Stripe Checkout handles card capture. Stripe Customer Portal handles invoice downloads and card management. Three Edge Functions bridge the client to Stripe (checkout session, portal session, webhook). A fourth Edge Function cron job expires free trials daily.

**Tech Stack:** React 19 + TypeScript, TanStack Query, Supabase (Postgres + Edge Functions + Deno runtime), Stripe SDK (`npm:stripe@17`), Tailwind CSS 4, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-04-03-billing-stripe-design.md`

---

## File Map

**New files:**
```
supabase/migrations/20260403000001_billing_tables.sql
supabase/migrations/20260403000002_plan_limit_triggers.sql
supabase/functions/create-checkout-session/index.ts
supabase/functions/create-portal-session/index.ts
supabase/functions/stripe-webhook/index.ts
supabase/functions/expire-trials/index.ts
modules/billing/hooks/useBilling.ts
modules/billing/components/TrialBanner.tsx
modules/billing/components/PastDueBanner.tsx
modules/billing/components/CurrentPlanCard.tsx
modules/billing/components/PlanCards.tsx
modules/billing/components/StripePortalSection.tsx
modules/billing/components/UpgradeModal.tsx
modules/billing/components/UpgradeSuccess.tsx
modules/billing/BillingModule.tsx
```

**Modified files:**
```
lib/auth.types.ts                   — add SubscriptionTier, Subscription types; add subscription_tier to ActiveSalon
context/AuthContext.tsx             — include subscription_tier in membership query; call initialize_salon_trial after salon creation
modules/settings/SettingsModule.tsx — add Abonnement card + billing section routing
components/Layout.tsx               — render PastDueBanner above children
```

---

## Task 1: DB Migration — billing tables

**Files:**
- Create: `supabase/migrations/20260403000001_billing_tables.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260403000001_billing_tables.sql

-- 1. Add 'past_due' to salons.subscription_tier check constraint
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_subscription_tier_check;
ALTER TABLE salons ADD CONSTRAINT salons_subscription_tier_check
  CHECK (subscription_tier IN ('trial', 'free', 'pro', 'enterprise', 'past_due'));

-- 2. subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id               uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  plan_id                uuid NOT NULL REFERENCES plans(id),
  status                 text NOT NULL CHECK (status IN ('trial','active','past_due','cancelled')),
  billing_cycle          text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_price_id        text,
  currency               text NOT NULL DEFAULT 'eur',
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_salon_id_unique UNIQUE (salon_id)
);

-- 3. invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id             uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  subscription_id      uuid NOT NULL REFERENCES subscriptions(id),
  stripe_invoice_id    text NOT NULL UNIQUE,
  stripe_event_id      text NOT NULL UNIQUE,
  amount_cents         integer NOT NULL,
  currency             text NOT NULL DEFAULT 'eur',
  status               text NOT NULL CHECK (status IN ('paid','open','uncollectible')),
  hosted_invoice_url   text,
  invoice_pdf_url      text,
  paid_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 4. updated_at trigger for subscriptions (reuse existing trigger function)
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon members read own subscription"
  ON subscriptions FOR SELECT
  USING (salon_id = ANY(user_salon_ids()));

CREATE POLICY "salon members read own invoices"
  ON invoices FOR SELECT
  USING (salon_id = ANY(user_salon_ids()));

-- Edge Functions use service role — no INSERT/UPDATE policies needed for app users
```

- [ ] **Step 2: Apply the migration**

```bash
cd "Salon-Saas"
npx supabase db push
```

Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Verify in Supabase Studio**

Open http://127.0.0.1:54323 (or remote Supabase dashboard) → Table Editor. Confirm `subscriptions` and `invoices` tables exist with correct columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260403000001_billing_tables.sql
git commit -m "feat: add subscriptions and invoices tables with RLS"
```

---

## Task 2: DB Migration — plan limit triggers

**Files:**
- Create: `supabase/migrations/20260403000002_plan_limit_triggers.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260403000002_plan_limit_triggers.sql

-- Trigger function that checks plan limits before INSERT
CREATE OR REPLACE FUNCTION check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_tier    text;
  v_count   integer;
  v_limit   integer;
BEGIN
  SELECT subscription_tier INTO v_tier FROM salons WHERE id = NEW.salon_id;

  IF TG_TABLE_NAME = 'staff_members' THEN
    CASE v_tier
      WHEN 'free'                        THEN v_limit := 2;
      WHEN 'pro', 'trial', 'past_due'   THEN v_limit := 10;
      ELSE v_limit := NULL; -- enterprise: unlimited
    END CASE;
    SELECT COUNT(*) INTO v_count
      FROM staff_members WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;

  ELSIF TG_TABLE_NAME = 'clients' THEN
    IF v_tier = 'free' THEN v_limit := 50; ELSE v_limit := NULL; END IF;
    SELECT COUNT(*) INTO v_count
      FROM clients WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;

  ELSIF TG_TABLE_NAME = 'products' THEN
    IF v_tier = 'free' THEN v_limit := 20; ELSE v_limit := NULL; END IF;
    SELECT COUNT(*) INTO v_count
      FROM products WHERE salon_id = NEW.salon_id AND deleted_at IS NULL;
  END IF;

  IF v_limit IS NOT NULL AND v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:%.%', TG_TABLE_NAME, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to tables
CREATE TRIGGER staff_members_plan_limit
  BEFORE INSERT ON staff_members
  FOR EACH ROW EXECUTE FUNCTION check_plan_limits();

CREATE TRIGGER clients_plan_limit
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION check_plan_limits();

CREATE TRIGGER products_plan_limit
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION check_plan_limits();
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: no errors. Three triggers created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260403000002_plan_limit_triggers.sql
git commit -m "feat: add plan limit enforcement triggers on staff, clients, products"
```

---

## Task 3: DB RPC — initialize_salon_trial

**Files:**
- Create: `supabase/migrations/20260403000003_initialize_salon_trial.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260403000003_initialize_salon_trial.sql

CREATE OR REPLACE FUNCTION initialize_salon_trial(p_salon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pro_plan_id uuid;
BEGIN
  SELECT id INTO v_pro_plan_id FROM plans WHERE name = 'Pro' LIMIT 1;

  INSERT INTO subscriptions (salon_id, plan_id, status, trial_ends_at)
  VALUES (
    p_salon_id,
    v_pro_plan_id,
    'trial',
    now() + interval '14 days'
  )
  ON CONFLICT (salon_id) DO NOTHING;

  UPDATE salons SET subscription_tier = 'trial' WHERE id = p_salon_id;
END;
$$;

-- Grant execute to authenticated users (called from client after salon creation)
GRANT EXECUTE ON FUNCTION initialize_salon_trial(uuid) TO authenticated;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260403000003_initialize_salon_trial.sql
git commit -m "feat: add initialize_salon_trial RPC function"
```

---

## Task 4: TypeScript types

**Files:**
- Modify: `lib/auth.types.ts`
- Modify: `context/AuthContext.tsx`

- [ ] **Step 1: Add SubscriptionTier and Subscription types to `lib/auth.types.ts`**

Add after the `AccessLevel` line at the end of the file:

```typescript
export type SubscriptionTier = 'trial' | 'free' | 'pro' | 'enterprise' | 'past_due';

export interface Subscription {
  id: string;
  salon_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  billing_cycle: 'monthly' | 'yearly';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  currency: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add `subscription_tier` to `ActiveSalon` in `lib/auth.types.ts`**

```typescript
export interface ActiveSalon {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  subscription_tier: SubscriptionTier;
}
```

Also add to the nested `salon` object inside `SalonMembership`:

```typescript
export interface SalonMembership {
  id: string;
  salon_id: string;
  profile_id: string;
  role: Role;
  status: 'pending' | 'active' | 'suspended';
  salon: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    currency: string;
    timezone: string;
    subscription_tier: SubscriptionTier;
  };
}
```

- [ ] **Step 3: Update the membership query in `context/AuthContext.tsx` to include `subscription_tier`**

Find the `fetchMemberships` function (search for `salon_memberships` + `select`). The salon sub-select needs `subscription_tier`. Change the salon select fields to include it:

```typescript
// In fetchMemberships, find the select string that lists salon fields and add subscription_tier
// Before: 'salon:salons(id, name, slug, logo_url, currency, timezone)'
// After:
'salon:salons(id, name, slug, logo_url, currency, timezone, subscription_tier)'
```

- [ ] **Step 4: Update `createSalon` in `context/AuthContext.tsx` to initialize the trial**

After the line `return { salonId: data as string, error: null };` and before it, add the trial call:

```typescript
const createSalon = useCallback(async (name: string, timezone = 'Europe/Paris', currency = 'MAD') => {
  const { data, error } = await supabase.rpc('create_salon', {
    p_name: name,
    p_timezone: timezone,
    p_currency: currency,
  });

  if (error) {
    return { salonId: null, error: error.message };
  }

  // Initialize 14-day Pro trial for the new salon
  await supabase.rpc('initialize_salon_trial', { p_salon_id: data });

  // Refetch memberships after salon creation
  if (user) {
    const updated = await fetchMemberships(user.id);
    setMemberships(updated);
    const newMembership = updated.find(m => m.salon_id === data);
    if (newMembership) {
      setActiveSalon(newMembership.salon);
      setRole(newMembership.role);
      localStorage.setItem('lastSalonId', newMembership.salon_id);
    }
  }

  return { salonId: data as string, error: null };
}, [user, fetchMemberships]);
```

- [ ] **Step 5: Verify the app compiles**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.types.ts context/AuthContext.tsx
git commit -m "feat: add SubscriptionTier and Subscription types, include subscription_tier in salon data, initialize trial on salon creation"
```

---

## Task 5: useBilling hook

**Files:**
- Create: `modules/billing/hooks/useBilling.ts`

- [ ] **Step 1: Create the hook**

```typescript
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
```

- [ ] **Step 2: Verify the app compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add modules/billing/hooks/useBilling.ts
git commit -m "feat: add useBilling hook with plan limits, checkout and portal session helpers"
```

---

## Task 6: Edge Function — create-checkout-session

**Files:**
- Create: `supabase/functions/create-checkout-session/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/create-checkout-session/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const appUrl = Deno.env.get('APP_URL')!;

    // Auth: verify calling user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { salon_id, plan_id } = await req.json();

    // Verify user is owner/manager of this salon
    const { data: membership } = await supabase
      .from('salon_memberships')
      .select('role')
      .eq('salon_id', salon_id)
      .eq('profile_id', user.id)
      .in('role', ['owner', 'manager'])
      .single();

    if (!membership) return new Response('Forbidden', { status: 403 });

    // Get Stripe price ID for this plan
    const { data: plan } = await supabase
      .from('plans')
      .select('stripe_price_id_monthly, name')
      .eq('id', plan_id)
      .single();

    if (!plan?.stripe_price_id_monthly) {
      return new Response(JSON.stringify({ error: 'Plan has no Stripe price configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('salon_id', salon_id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const { data: salon } = await supabase
        .from('salons')
        .select('name, email')
        .eq('id', salon_id)
        .single();

      const customer = await stripe.customers.create({
        name: salon?.name,
        email: salon?.email || user.email,
        metadata: { salon_id },
      });
      customerId = customer.id;

      // Save customer ID early so portal works even if checkout is abandoned
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('salon_id', salon_id);
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id_monthly, quantity: 1 }],
      success_url: `${appUrl}/settings?section=billing&success=true`,
      cancel_url: `${appUrl}/settings?section=billing`,
      metadata: { salon_id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-checkout-session/index.ts
git commit -m "feat: add create-checkout-session Edge Function"
```

---

## Task 7: Edge Function — create-portal-session

**Files:**
- Create: `supabase/functions/create-portal-session/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/create-portal-session/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const appUrl = Deno.env.get('APP_URL')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { salon_id } = await req.json();

    // Verify membership
    const { data: membership } = await supabase
      .from('salon_memberships')
      .select('role')
      .eq('salon_id', salon_id)
      .eq('profile_id', user.id)
      .in('role', ['owner', 'manager'])
      .single();

    if (!membership) return new Response('Forbidden', { status: 403 });

    // Get Stripe customer ID
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('salon_id', salon_id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Aucun abonnement actif. Choisissez un plan pour commencer.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/settings?section=billing`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-portal-session/index.ts
git commit -m "feat: add create-portal-session Edge Function"
```

---

## Task 8: Edge Function — stripe-webhook

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/stripe-webhook/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify Stripe signature — MUST be first
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const salonId = session.metadata?.salon_id;
        if (!salonId || session.mode !== 'subscription') break;

        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        const { data: plans } = await supabase
          .from('plans')
          .select('id, name')
          .eq('stripe_price_id_monthly', stripeSubscription.items.data[0].price.id)
          .single();

        const tier = plans?.name?.toLowerCase() === 'enterprise' ? 'enterprise' : 'pro';

        await supabase.from('subscriptions').upsert({
          salon_id: salonId,
          plan_id: plans?.id,
          status: 'active',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          stripe_price_id: stripeSubscription.items.data[0].price.id,
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        }, { onConflict: 'salon_id' });

        await supabase.from('salons')
          .update({ subscription_tier: tier })
          .eq('id', salonId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('salon_id')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (!subscription) break;

        const { data: plan } = await supabase
          .from('plans')
          .select('id, name')
          .eq('stripe_price_id_monthly', sub.items.data[0].price.id)
          .single();

        const tier = plan?.name?.toLowerCase() === 'enterprise' ? 'enterprise' : 'pro';

        await supabase.from('subscriptions').update({
          status: sub.status === 'past_due' ? 'past_due' : 'active',
          stripe_price_id: sub.items.data[0].price.id,
          plan_id: plan?.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);

        await supabase.from('salons')
          .update({ subscription_tier: sub.status === 'past_due' ? 'past_due' : tier })
          .eq('id', subscription.salon_id);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        // Idempotency: skip if already processed
        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('stripe_event_id', event.id)
          .single();

        if (existing) break;

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('id, salon_id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        if (!subscription) break;

        await supabase.from('invoices').insert({
          salon_id: subscription.salon_id,
          subscription_id: subscription.id,
          stripe_invoice_id: invoice.id,
          stripe_event_id: event.id,
          amount_cents: invoice.amount_paid,
          currency: invoice.currency,
          status: 'paid',
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf_url: invoice.invoice_pdf,
          paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
        });

        await supabase.from('subscriptions').update({
          current_period_end: new Date((invoice.lines.data[0]?.period.end ?? 0) * 1000).toISOString(),
          status: 'active',
        }).eq('id', subscription.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        await supabase.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription as string);

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('salon_id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        if (subscription) {
          await supabase.from('salons')
            .update({ subscription_tier: 'past_due' })
            .eq('id', subscription.salon_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('salon_id')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (!subscription) break;

        // Stripe Customer Portal cancels at period end — deletion event fires at period end
        // So setting free immediately is correct
        await supabase.from('subscriptions').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id);

        await supabase.from('salons')
          .update({ subscription_tier: 'free' })
          .eq('id', subscription.salon_id);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Webhook handler error:', err);
    // Still return 200 so Stripe does not retry for app-level errors
    return new Response(JSON.stringify({ received: true, error: (err as Error).message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: add stripe-webhook Edge Function with signature verification and idempotency"
```

---

## Task 9: Edge Function — expire-trials (cron)

**Files:**
- Create: `supabase/functions/expire-trials/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/expire-trials/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find expired trials with no active paid subscription
  const { data: expired, error } = await supabase
    .from('subscriptions')
    .select('salon_id')
    .eq('status', 'trial')
    .lt('trial_ends_at', new Date().toISOString());

  if (error) {
    console.error('Failed to fetch expired trials:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let count = 0;
  for (const { salon_id } of (expired ?? [])) {
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('salon_id', salon_id)
      .eq('status', 'trial'); // only downgrade if still trial (not past_due)

    await supabase
      .from('salons')
      .update({ subscription_tier: 'free' })
      .eq('id', salon_id);

    count++;
  }

  console.log(`Expired ${count} trials`);
  return new Response(JSON.stringify({ expired: count }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Schedule the cron in `supabase/config.toml`**

Open `supabase/config.toml` and add inside the `[functions]` section (create if it doesn't exist):

```toml
[functions.expire-trials]
schedule = "0 2 * * *"
```

This runs daily at 02:00 UTC.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/expire-trials/index.ts supabase/config.toml
git commit -m "feat: add expire-trials cron Edge Function (daily at 02:00 UTC)"
```

---

## Task 10: Component — TrialBanner

**Files:**
- Create: `modules/billing/components/TrialBanner.tsx`

- [ ] **Step 1: Create the component**

```typescript
// modules/billing/components/TrialBanner.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';

interface TrialBannerProps {
  daysLeft: number;
  onUpgradeClick: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ daysLeft, onUpgradeClick }) => (
  <div className="bg-gradient-to-r from-brand-500 to-rose-500 text-white px-6 py-3 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <Sparkles size={16} className="shrink-0" />
      <div>
        <span className="font-semibold text-sm">Essai Pro — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</span>
        <span className="text-white/80 text-sm ml-2 hidden sm:inline">
          Toutes les fonctionnalités Pro gratuitement.
        </span>
      </div>
    </div>
    <button
      onClick={onUpgradeClick}
      className="shrink-0 bg-white text-brand-500 text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
    >
      Choisir un plan →
    </button>
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/components/TrialBanner.tsx
git commit -m "feat: add TrialBanner component"
```

---

## Task 11: Component — PastDueBanner

**Files:**
- Create: `modules/billing/components/PastDueBanner.tsx`

- [ ] **Step 1: Create the component**

```typescript
// modules/billing/components/PastDueBanner.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface PastDueBannerProps {
  onFixClick: () => void;
  isLoading?: boolean;
}

export const PastDueBanner: React.FC<PastDueBannerProps> = ({ onFixClick, isLoading }) => (
  <div className="bg-rose-600 text-white px-6 py-3 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <AlertTriangle size={16} className="shrink-0" />
      <span className="text-sm font-medium">
        Votre paiement a échoué. Mettez à jour votre carte bancaire pour conserver votre accès Pro.
      </span>
    </div>
    <button
      onClick={onFixClick}
      disabled={isLoading}
      className="shrink-0 bg-white text-rose-600 text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-white/90 disabled:opacity-50 transition-colors"
    >
      {isLoading ? '...' : 'Mettre à jour →'}
    </button>
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/components/PastDueBanner.tsx
git commit -m "feat: add PastDueBanner component"
```

---

## Task 12: Component — CurrentPlanCard

**Files:**
- Create: `modules/billing/components/CurrentPlanCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// modules/billing/components/CurrentPlanCard.tsx
import React from 'react';
import type { Subscription, SubscriptionTier } from '../../../lib/auth.types';
import type { PLAN_LIMITS } from '../hooks/useBilling';

interface UsageBarProps {
  label: string;
  current: number;
  max: number | null;
}

const UsageBar: React.FC<UsageBarProps> = ({ label, current, max }) => {
  const pct = max === null ? 0 : Math.min(100, Math.round((current / max) * 100));
  const isNearLimit = max !== null && pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className={`font-semibold ${isNearLimit ? 'text-rose-600' : 'text-slate-900'}`}>
          {current} / {max === null ? 'illimité' : max}
        </span>
      </div>
      <div className="bg-slate-100 rounded-full h-1.5">
        {max !== null && (
          <div
            className={`h-1.5 rounded-full transition-all ${isNearLimit ? 'bg-rose-500' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  trial: 'Pro (Essai)',
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
  past_due: 'Pro',
};

const TIER_BADGES: Record<SubscriptionTier, { label: string; className: string }> = {
  trial:      { label: 'ESSAI',     className: 'bg-blue-100 text-blue-700' },
  free:       { label: 'FREE',      className: 'bg-slate-100 text-slate-600' },
  pro:        { label: 'PRO',       className: 'bg-brand-100 text-brand-700' },
  enterprise: { label: 'ENTERPRISE',className: 'bg-purple-100 text-purple-700' },
  past_due:   { label: 'IMPAYÉ',    className: 'bg-rose-100 text-rose-700' },
};

interface CurrentPlanCardProps {
  subscription: Subscription | undefined;
  tier: SubscriptionTier;
  limits: typeof PLAN_LIMITS[SubscriptionTier];
  staffCount: number;
  clientCount: number;
  productCount: number;
  onManageBilling: () => void;
  isLoadingPortal: boolean;
}

export const CurrentPlanCard: React.FC<CurrentPlanCardProps> = ({
  subscription, tier, limits, staffCount, clientCount, productCount,
  onManageBilling, isLoadingPortal,
}) => {
  const badge = TIER_BADGES[tier];
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 justify-between">
      <div className="flex-1">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Plan actuel</div>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-2xl font-extrabold text-slate-900">{TIER_LABELS[tier]}</span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        {renewalDate && (
          <div className="text-sm text-slate-500 mb-5">
            {tier === 'trial' ? `Essai jusqu'au` : `Renouvellement le`} {renewalDate}
          </div>
        )}
        <div className="flex flex-col gap-3 max-w-sm">
          <UsageBar label="Membres d'équipe" current={staffCount} max={limits.staff} />
          <UsageBar label="Clients" current={clientCount} max={limits.clients} />
          <UsageBar label="Produits" current={productCount} max={limits.products} />
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
        <button
          onClick={onManageBilling}
          disabled={isLoadingPortal}
          className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isLoadingPortal ? '...' : 'Gérer la facturation ↗'}
        </button>
        <p className="text-xs text-slate-400 text-right">Factures, carte bancaire,<br className="hidden sm:block" /> annulation via Stripe</p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/components/CurrentPlanCard.tsx
git commit -m "feat: add CurrentPlanCard component with usage bars"
```

---

## Task 13: Component — PlanCards

**Files:**
- Create: `modules/billing/components/PlanCards.tsx`

- [ ] **Step 1: Create the component**

```typescript
// modules/billing/components/PlanCards.tsx
import React from 'react';
import type { SubscriptionTier } from '../../../lib/auth.types';

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  max_staff: number | null;
  max_clients: number | null;
  max_products: number | null;
  features: { analytics: boolean; api_access: boolean; custom_branding: boolean };
  stripe_price_id_monthly: string | null;
}

interface PlanCardsProps {
  plans: Plan[];
  currentTier: SubscriptionTier;
  onSelectPlan: (planId: string) => void;
  isLoading: boolean;
}

const TIER_FROM_NAME: Record<string, SubscriptionTier> = {
  Free: 'free',
  Pro: 'pro',
  Enterprise: 'enterprise',
};

export const PlanCards: React.FC<PlanCardsProps> = ({ plans, currentTier, onSelectPlan, isLoading }) => (
  <div>
    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Changer de plan</div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {plans.map((plan) => {
        const planTier = TIER_FROM_NAME[plan.name] ?? 'free';
        const isCurrent = planTier === currentTier || (currentTier === 'trial' && planTier === 'pro');
        const isUpgrade = plan.price_monthly > 0 && !isCurrent;
        const isDowngrade = planTier === 'free' && currentTier !== 'free';

        return (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl p-5 border-2 transition-all ${
              isCurrent ? 'border-brand-500' : 'border-slate-200'
            }`}
          >
            {isCurrent && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full whitespace-nowrap">
                PLAN ACTUEL
              </div>
            )}

            <div className="font-bold text-slate-900 text-base mb-1">{plan.name}</div>
            <div className="text-3xl font-extrabold text-slate-900 mb-4">
              {plan.price_monthly === 0 ? '0 €' : `${plan.price_monthly.toFixed(2)} €`}
              <span className="text-sm font-normal text-slate-400"> /mois</span>
            </div>

            <ul className="space-y-2 mb-5 text-sm">
              <li className="text-slate-600">
                ✓ {plan.max_staff === null ? 'Membres illimités' : `${plan.max_staff} membres max`}
              </li>
              <li className="text-slate-600">
                ✓ {plan.max_clients === null ? 'Clients illimités' : `${plan.max_clients} clients max`}
              </li>
              <li className={plan.features.analytics ? 'text-slate-600' : 'text-slate-300'}>
                {plan.features.analytics ? '✓' : '✗'} Analytics
              </li>
              <li className={plan.features.custom_branding ? 'text-slate-600' : 'text-slate-300'}>
                {plan.features.custom_branding ? '✓' : '✗'} Branding personnalisé
              </li>
              {plan.features.api_access && (
                <li className="text-slate-600">✓ Accès API</li>
              )}
            </ul>

            {isCurrent ? (
              <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-400 cursor-default">
                Plan actuel
              </button>
            ) : isDowngrade ? (
              <button
                onClick={() => onSelectPlan(plan.id)}
                disabled={isLoading || !plan.stripe_price_id_monthly}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Rétrograder
              </button>
            ) : (
              <button
                onClick={() => onSelectPlan(plan.id)}
                disabled={isLoading || !plan.stripe_price_id_monthly}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {isLoading ? '...' : isUpgrade ? `Passer en ${plan.name} →` : `Choisir ${plan.name} →`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/components/PlanCards.tsx
git commit -m "feat: add PlanCards component"
```

---

## Task 14: Component — StripePortalSection

**Files:**
- Create: `modules/billing/components/StripePortalSection.tsx`

- [ ] **Step 1: Create the component**

```typescript
// modules/billing/components/StripePortalSection.tsx
import React from 'react';
import { CreditCard } from 'lucide-react';

interface StripePortalSectionProps {
  onOpenPortal: () => void;
  isLoading: boolean;
}

export const StripePortalSection: React.FC<StripePortalSectionProps> = ({ onOpenPortal, isLoading }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
      <CreditCard size={18} className="text-slate-600" />
    </div>
    <div className="flex-1">
      <div className="text-sm font-semibold text-slate-900">Facturation sécurisée via Stripe</div>
      <div className="text-xs text-slate-500 mt-0.5">
        Téléchargez vos factures, modifiez votre carte bancaire ou annulez depuis le portail Stripe.
      </div>
    </div>
    <button
      onClick={onOpenPortal}
      disabled={isLoading}
      className="shrink-0 border border-slate-300 bg-white text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
    >
      {isLoading ? '...' : 'Ouvrir le portail →'}
    </button>
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/components/StripePortalSection.tsx
git commit -m "feat: add StripePortalSection component"
```

---

## Task 15: Component — UpgradeModal

**Files:**
- Create: `modules/billing/components/UpgradeModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// modules/billing/components/UpgradeModal.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const RESOURCE_COPY = {
  staff: {
    headline: 'Débloquez une équipe illimitée',
    description: 'Passez en Pro pour inviter jusqu\'à 10 membres et gérer votre salon en équipe.',
  },
  clients: {
    headline: 'Débloquez des clients illimités',
    description: 'Passez en Pro pour gérer un nombre illimité de clients.',
  },
  products: {
    headline: 'Débloquez des produits illimités',
    description: 'Passez en Pro pour ajouter autant de produits que vous le souhaitez.',
  },
};

interface UpgradeModalProps {
  resource: 'staff' | 'clients' | 'products';
  onUpgrade: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ resource, onUpgrade, onClose, isLoading }) => {
  const copy = RESOURCE_COPY[resource];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-lg font-extrabold text-slate-900 mb-2 leading-snug">{copy.headline}</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {copy.description}
          </p>
        </div>

        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-5">
          <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2.5">
            Ce que vous débloquez avec Pro
          </div>
          <ul className="space-y-2 text-sm text-slate-800">
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Jusqu'à 10 membres d'équipe
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Clients illimités
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Analytics & rapports avancés
            </li>
            <li className="flex items-center gap-2">
              <span className="text-brand-500 font-bold">✓</span> Branding personnalisé
            </li>
          </ul>
        </div>

        <div className="text-center text-2xl font-extrabold text-slate-900 mb-4">
          29,99 €<span className="text-sm font-normal text-slate-400">/mois</span>
        </div>

        <button
          onClick={onUpgrade}
          disabled={isLoading}
          className="w-full py-3.5 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors text-sm"
        >
          {isLoading ? 'Redirection...' : 'Passer en Pro →'}
        </button>

        <div className="flex justify-center gap-5 mt-4 text-xs text-slate-400">
          <span>✓ Résiliable à tout moment</span>
          <span>🔒 Paiement via Stripe</span>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/components/UpgradeModal.tsx
git commit -m "feat: add UpgradeModal component with positive framing and trust signals"
```

---

## Task 16: Component — UpgradeSuccess

**Files:**
- Create: `modules/billing/components/UpgradeSuccess.tsx`

- [ ] **Step 1: Create the component**

```typescript
// modules/billing/components/UpgradeSuccess.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const UpgradeSuccess: React.FC = () => {
  const navigate = useNavigate();

  const handleContinue = () => {
    // Remove ?success=true from URL and go to dashboard
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="text-6xl mb-3">🎉</div>
      <div className="text-[10px] font-bold text-brand-500 uppercase tracking-[.2em] mb-3">
        Bienvenue sur Pro
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-2 leading-snug">
        Votre salon est maintenant<br />sur le plan Pro !
      </h2>
      <p className="text-sm text-slate-500 mb-7 leading-relaxed">
        Toutes vos fonctionnalités Pro sont immédiatement disponibles.
      </p>

      <div className="bg-slate-50 rounded-xl p-4 mb-7 text-left space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center text-lg shrink-0">👥</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Équipe jusqu'à 10 membres</div>
            <div className="text-xs text-slate-400">Invitez maintenant depuis l'onglet Équipe</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center text-lg shrink-0">📊</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Analytics activés</div>
            <div className="text-xs text-slate-400">Explorez vos performances depuis le tableau de bord</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full py-3.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
      >
        Continuer vers l'application →
      </button>
      <p className="text-xs text-slate-400 mt-4">Un reçu a été envoyé à votre adresse email</p>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/components/UpgradeSuccess.tsx
git commit -m "feat: add UpgradeSuccess celebration component"
```

---

## Task 17: BillingModule assembly

**Files:**
- Create: `modules/billing/BillingModule.tsx`

- [ ] **Step 1: Create the module**

```typescript
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

  // Find Pro plan for upgrade modal
  const proPlan = plans.find(p => p.name === 'Pro');

  const handleUpgradeFromModal = async () => {
    if (proPlan) await createCheckoutSession(proPlan.id);
  };

  if (isSuccess) {
    return (
      <div className="w-full py-8 px-4 animate-in fade-in duration-500">
        <UpgradeSuccess />
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
          isLoading={isLoadingCheckout}
        />

        <StripePortalSection
          onOpenPortal={createPortalSession}
          isLoading={isLoadingPortal}
        />
      </div>

      {showUpgradeModal && proPlan && (
        <UpgradeModal
          resource="staff"
          onUpgrade={handleUpgradeFromModal}
          onClose={() => setShowUpgradeModal(false)}
          isLoading={isLoadingCheckout}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/billing/BillingModule.tsx
git commit -m "feat: add BillingModule assembling all billing components"
```

---

## Task 18: Settings integration

**Files:**
- Modify: `modules/settings/SettingsModule.tsx`

- [ ] **Step 1: Add billing import and section to `SettingsModule.tsx`**

At the top of `SettingsModule.tsx`, add the import:

```typescript
import { BillingModule } from '../billing/BillingModule';
```

In the `sections` array, add as the **first item** (so it's prominent):

```typescript
{ id: 'billing', icon: CreditCard, title: 'Abonnement & Facturation', description: 'Plan actuel, usage, factures.' },
```

`CreditCard` is already imported. Add the billing route to the `if` chain before the catch-all:

```typescript
if (activeSection === 'billing') {
  return <BillingModule onBack={() => setActiveSection(null)} />;
}
```

- [ ] **Step 2: Verify the app renders — open Settings and click Abonnement**

```bash
npm run dev
```

Navigate to Settings. The Abonnement & Facturation card should appear first. Clicking it should open the billing page.

- [ ] **Step 3: Commit**

```bash
git add modules/settings/SettingsModule.tsx
git commit -m "feat: add Abonnement & Facturation to Settings module"
```

---

## Task 19: Global integrations — Layout PastDueBanner

**Files:**
- Modify: `components/Layout.tsx`

- [ ] **Step 1: Import PastDueBanner in `Layout.tsx`**

```typescript
import { PastDueBanner } from '../modules/billing/components/PastDueBanner';
```

- [ ] **Step 2: Render PastDueBanner above `{children}` in the main content area**

Find the line with `{children}` (line 357). The main content area renders children inside a scrollable div. Add the banner just before children:

```typescript
{/* Past due banner — shown globally when payment has failed */}
{activeSalon?.subscription_tier === 'past_due' && (
  <PastDueBannerConnected />
)}
{children}
```

Add this small connected component at the top of `Layout.tsx` (before the `Layout` export):

```typescript
const PastDueBannerConnected: React.FC = () => {
  const { createPortalSession, isLoadingPortal } = useBilling();
  return <PastDueBanner onFixClick={createPortalSession} isLoading={isLoadingPortal} />;
};
```

Import `useBilling` at the top:

```typescript
import { useBilling } from '../modules/billing/hooks/useBilling';
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add components/Layout.tsx
git commit -m "feat: render PastDueBanner globally in Layout when payment has failed"
```

---

## Task 20: Stripe configuration + end-to-end test checklist

This task is manual configuration, not code.

- [ ] **Step 1: Create a Stripe account**

Go to stripe.com → sign up → activate test mode.

- [ ] **Step 2: Create products in Stripe**

Stripe dashboard → Products → Add product:
- **Pro**: €29.99/month recurring → copy the Price ID (starts with `price_`)
- **Enterprise**: €79.99/month recurring → copy the Price ID

- [ ] **Step 3: Update the `plans` table with Stripe price IDs**

In Supabase Studio → Table Editor → `plans`:
- Set `stripe_price_id_monthly` for Pro row to the Pro price ID
- Set `stripe_price_id_monthly` for Enterprise row to the Enterprise price ID

- [ ] **Step 4: Store Stripe secrets in Supabase**

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...  # set after Step 6
npx supabase secrets set APP_URL=https://salon-saas-drab.vercel.app
```

- [ ] **Step 5: Deploy Edge Functions**

```bash
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-portal-session
npx supabase functions deploy stripe-webhook
npx supabase functions deploy expire-trials
```

- [ ] **Step 6: Register the webhook in Stripe**

Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://<your-supabase-project-ref>.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- Copy the webhook signing secret → run Step 4 again with the real `STRIPE_WEBHOOK_SECRET`

- [ ] **Step 7: Enable Stripe Customer Portal**

Stripe dashboard → Settings → Billing → Customer Portal → Activate.

- [ ] **Step 8: End-to-end test with Stripe test cards**

Test the full flow:
1. Create a new salon → verify 14-day trial subscription row created in `subscriptions` table
2. Go to Settings → Abonnement → trial banner shows days remaining
3. Click "S'abonner" on Pro → redirects to Stripe Checkout
4. Use test card `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete checkout → verify redirected to `/settings?section=billing&success=true`
6. Verify `UpgradeSuccess` screen shown
7. Verify `subscriptions.status = 'active'` and `salons.subscription_tier = 'pro'` in DB
8. Click "Gérer la facturation" → redirects to Stripe Customer Portal
9. Test failed payment: use card `4000 0000 0000 0341` → verify `past_due` banner appears
10. Test cancellation via portal → verify `subscription_tier` reverts to `free`

- [ ] **Step 9: Deploy to Vercel**

```bash
vercel --prod
```

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "feat: complete Stripe billing integration — checkout, portal, webhook, trial, plan limits"
```

---

## Self-Review Notes

- All 8 spec sections are covered: DB schema (Tasks 1-3), Edge Functions (Tasks 6-9), Trial logic (Task 4 + 20), Plan limits (Tasks 2 + 5), UI components (Tasks 10-17), Settings integration (Task 18), Global banners (Task 19), Stripe config (Task 20)
- `UpgradeModal` is built but only shown from `BillingModule` and `TrialBanner` at this stage. To wire it up at the point of limit enforcement (e.g., clicking "Nouveau membre" on team page), each relevant module (team, clients, products) needs to call `useBilling().canAddStaff()` before opening its form and show `<UpgradeModal>` if false. This is a follow-up integration — the modal component is ready to be dropped in.
- `brand-100` and `brand-600` Tailwind classes are used — verify these are defined in your Tailwind config (brand-500 is confirmed; check adjacent shades).
