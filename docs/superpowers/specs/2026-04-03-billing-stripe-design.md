# Billing & Stripe Integration — Design Spec

**Date:** 2026-04-03
**Scope:** Full Stripe subscription billing system for Lumiere Beauty SaaS
**Status:** Approved for implementation

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Where does billing UI live? | Settings → "Abonnement & Facturation" card |
| Free trial? | 14-day Pro trial on every new signup |
| Plan limits enforcement | Hard block with upgrade modal (no soft warnings) |
| Billing cycle | Monthly only (yearly can be added later) |
| Invoice management | Stripe Customer Portal (not custom-built) |
| Scope | Full end-to-end: UI + Stripe Checkout + webhooks + DB |

---

## 1. Database Schema

### 1.1 New table: `subscriptions`

```sql
CREATE TABLE subscriptions (
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
```

- One active subscription per salon (UNIQUE constraint on `salon_id`)
- `stripe_customer_id` is set on first checkout and reused for the portal
- `stripe_price_id` is Stripe's source of truth for what was purchased
- `updated_at` managed by existing trigger pattern

### 1.2 New table: `invoices`

```sql
CREATE TABLE invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id             uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  subscription_id      uuid NOT NULL REFERENCES subscriptions(id),
  stripe_invoice_id    text NOT NULL UNIQUE,
  stripe_event_id      text NOT NULL UNIQUE,  -- idempotency key
  amount_cents         integer NOT NULL,       -- always store money as cents
  currency             text NOT NULL DEFAULT 'eur',
  status               text NOT NULL CHECK (status IN ('paid','open','uncollectible')),
  hosted_invoice_url   text,                  -- Stripe-hosted payment page
  invoice_pdf_url      text,                  -- direct PDF download
  paid_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

- `stripe_event_id` prevents duplicate inserts when Stripe retries webhooks
- `amount_cents` integer avoids floating-point money bugs
- Invoice data is read-only — never updated by app, only inserted by webhook

### 1.3 RLS Policies

```sql
-- subscriptions: salon owners/managers can read their own
CREATE POLICY "salon members read own subscription"
  ON subscriptions FOR SELECT
  USING (salon_id = ANY(user_salon_ids()));

-- subscriptions: only Edge Functions write (via service role)
-- No app-level INSERT/UPDATE policy — all writes go through Edge Functions

-- invoices: same read pattern
CREATE POLICY "salon members read own invoices"
  ON invoices FOR SELECT
  USING (salon_id = ANY(user_salon_ids()));
```

### 1.4 `salons` table — no changes needed

`subscription_tier` (trial | free | pro | enterprise) already exists and is the app's runtime source of truth. The webhook keeps it in sync with Stripe.

---

## 2. Supabase Edge Functions (3 functions)

All three use the Stripe secret key stored as a Supabase secret (`STRIPE_SECRET_KEY`). The webhook also uses `STRIPE_WEBHOOK_SECRET`.

### 2.1 `create-checkout-session`

**Triggered by:** User clicks "S'abonner →" on a plan card
**Called from:** `useBilling` hook via `supabase.functions.invoke()`

**Logic:**
1. Receive `{ salon_id, plan_id }` from client
2. Look up `stripe_price_id` from `plans` table for the selected plan
3. Look up existing `stripe_customer_id` from `subscriptions` (if any)
4. If no customer yet: create Stripe customer with salon name + owner email
5. Create Stripe Checkout session with:
   - `mode: 'subscription'`
   - `customer`: existing or newly created
   - `line_items`: the plan's `stripe_price_id`
   - `success_url`: `{APP_URL}/settings/billing?success=true`
   - `cancel_url`: `{APP_URL}/settings/billing`
   - `metadata`: `{ salon_id }` — needed by webhook to find the salon
6. Return `{ url }` — client redirects to it

**Security:** Validate that the calling user is owner/manager of `salon_id` via `auth.uid()`.

### 2.2 `create-portal-session`

**Triggered by:** User clicks "Gérer la facturation ↗"
**Called from:** `useBilling` hook

**Logic:**
1. Receive `{ salon_id }` from client
2. Look up `stripe_customer_id` from `subscriptions`
3. If no customer (free plan, never paid): return error — show message "Aucun abonnement actif"
4. Create Stripe Billing Portal session with `return_url: {APP_URL}/settings/billing`
5. Return `{ url }` — client redirects to it

### 2.3 `stripe-webhook`

**Triggered by:** Stripe HTTP POST to `{SUPABASE_URL}/functions/v1/stripe-webhook`
**Registered in:** Stripe dashboard → Webhooks

**Critical: Signature verification (first thing, every time):**
```typescript
const signature = req.headers.get('stripe-signature')
const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
// throws if invalid — return 400
```

**Idempotency:** Before processing any invoice event, check if `stripe_event_id` already exists in `invoices`. If yes, return 200 immediately.

**Events handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upsert `subscriptions` row with customer/subscription IDs. Set `salon.subscription_tier = 'pro'` (or enterprise). |
| `customer.subscription.updated` | Update `subscriptions.status`, `current_period_end`, `stripe_price_id`. Update `salon.subscription_tier` if plan changed. |
| `invoice.paid` | Insert into `invoices` (status=paid). Update `subscriptions.current_period_end`. |
| `invoice.payment_failed` | Set `subscriptions.status = 'past_due'`. Set `salon.subscription_tier = 'past_due'` (new tier value needed). |
| `customer.subscription.deleted` | Set `subscriptions.status = 'cancelled'`, `cancelled_at = now()`, set `salon.subscription_tier = 'free'`. Note: Stripe Customer Portal cancels at period end by default, so this event fires *at* period end — setting free immediately is correct. |

**Return 200 to Stripe always** (even for unhandled events) — otherwise Stripe retries indefinitely.

---

## 3. Trial Logic

### 3.1 On salon creation (`CreateSalonPage`)

After inserting the salon row, call an RPC `initialize_salon_trial(salon_id)` that:
1. Inserts into `subscriptions`: `status='trial'`, `trial_ends_at = now() + interval '14 days'`, `plan_id = pro_plan_id`
2. Updates `salons.subscription_tier = 'trial'`

### 3.2 Trial expiry (Edge Function cron)

A Supabase Edge Function `expire-trials` scheduled to run **daily at 02:00 UTC**:

```typescript
// Find salons where trial ended and no active paid subscription
const expiredTrials = await supabase
  .from('subscriptions')
  .select('salon_id')
  .eq('status', 'trial')
  .lt('trial_ends_at', new Date().toISOString())

// Downgrade each to free
for (const { salon_id } of expiredTrials) {
  await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('salon_id', salon_id)
  await supabase.from('salons').update({ subscription_tier: 'free' }).eq('id', salon_id)
}
```

Does NOT downgrade `past_due` subscriptions — those have a real billing relationship.

---

## 4. Plan Limit Enforcement

### 4.1 Where limits are checked

**Defense in depth — two layers:**

1. **UI layer** (`useBilling` hook): Before opening the "Nouveau membre" form, check `canAddStaff()`. If false, show the upgrade modal instead.
2. **DB layer** (Postgres trigger): A `BEFORE INSERT` trigger on `staff_members`, `clients`, `products` checks the salon's plan limits. Returns an error if exceeded. This is the authoritative enforcement — the UI check is for UX only.

### 4.2 Limits per plan

| Resource | Free | Pro | Enterprise |
|----------|------|-----|-----------|
| Staff members | 2 | 10 | unlimited |
| Clients | 50 | unlimited | unlimited |
| Products | 20 | unlimited | unlimited |

### 4.3 `useBilling` hook (new shared hook)

```typescript
// modules/billing/hooks/useBilling.ts
export function useBilling() {
  const { activeSalon } = useAuth()

  // Fetches subscription row for current salon
  const { data: subscription } = useQuery(...)

  // Limit checks
  const canAddStaff = (currentCount: number) => { ... }
  const canAddClient = (currentCount: number) => { ... }
  const canAddProduct = (currentCount: number) => { ... }

  // Actions (call Edge Functions)
  const createCheckoutSession = async (planId: string) => { ... }
  const createPortalSession = async () => { ... }

  return { subscription, canAddStaff, canAddClient, canAddProduct, createCheckoutSession, createPortalSession }
}
```

---

## 5. UI Components

### 5.1 Settings card (existing `SettingsModule.tsx`)

Add to the sections array:
```typescript
{ id: 'billing', icon: CreditCard, title: 'Abonnement & Facturation', description: 'Plan actuel, usage, factures.' }
```

### 5.2 `BillingSettings` component

Sections (top to bottom):
1. **Trial banner** — pink gradient, shown only when `status === 'trial'`. Shows days remaining. Disappears when subscribed.
2. **`past_due` banner** — red, shown when `status === 'past_due'`. "Votre paiement a échoué — Mettre à jour votre carte →" links to portal. Shown across the entire app (rendered in `Layout.tsx`), not only on the billing page.
3. **Current plan card** — plan name + badge + renewal date + usage bars (staff, clients, products as % of limit)
4. **Plan cards** — Free / Pro / Enterprise. Current plan highlighted with pink border + "PLAN ACTUEL" badge. Upgrade/downgrade buttons call `createCheckoutSession` or `createPortalSession`.
5. **Stripe portal section** — "Gérer la facturation ↗" button + "Télécharger vos factures, modifier votre carte bancaire" explainer. Calls `createPortalSession`.

### 5.3 `UpgradeModal` component (global)

Reusable modal triggered from anywhere in the app when a limit is hit.

Props: `{ resource: 'staff' | 'clients' | 'products', currentPlan: string, onClose: () => void }`

Content:
- Positive headline: "Débloquez une équipe illimitée" (context-aware per resource)
- Pink feature list showing what Pro unlocks
- Single CTA: "Passer en Pro — 29,99 €/mois →"
- X button to close (no guilt secondary button)
- Trust signals: "✓ Résiliable à tout moment · 🔒 Paiement via Stripe"

### 5.4 `UpgradeSuccess` page

Full-page component rendered when `?success=true` is present in the URL after Stripe redirect.

Content:
- 🎉 emoji + "Bienvenue sur Pro"
- What's now unlocked (staff limit, analytics, branding)
- "Continuer vers l'application →" button (clears the `?success` param)
- "Un reçu a été envoyé à votre adresse email"

Shown once. Navigating away removes the `?success` param.

### 5.5 `past_due` banner (global)

Rendered in `Layout.tsx` when `subscription_tier === 'past_due'`:

```
⚠️  Votre paiement a échoué. Mettez à jour votre carte bancaire pour conserver votre accès Pro.  [Mettre à jour →]
```

Persists across all pages until resolved.

---

## 6. File Structure

```
modules/billing/
  BillingModule.tsx           # Main Abonnement page (rendered from Settings)
  hooks/useBilling.ts         # Subscription state + limit checks + Edge Function calls
  components/
    CurrentPlanCard.tsx       # Plan name, badge, usage bars
    PlanCards.tsx             # Free / Pro / Enterprise comparison
    StripePortalSection.tsx   # "Gérer la facturation" button + explainer
    UpgradeModal.tsx          # Hard block modal (global, reusable)
    UpgradeSuccess.tsx        # Post-checkout celebration page
    TrialBanner.tsx           # Pink trial countdown banner
    PastDueBanner.tsx         # Red payment failed banner (rendered in Layout)

supabase/
  migrations/
    YYYYMMDD_billing_tables.sql   # subscriptions + invoices tables + RLS
    YYYYMMDD_plan_limit_triggers.sql  # BEFORE INSERT triggers on staff/clients/products
  functions/
    create-checkout-session/index.ts
    create-portal-session/index.ts
    stripe-webhook/index.ts
    expire-trials/index.ts        # cron: daily trial expiry
```

---

## 7. Stripe Configuration Checklist

- [ ] Create Stripe account + products (Free, Pro, Enterprise)
- [ ] Get `stripe_price_id` for each plan → update `plans` table
- [ ] Store `STRIPE_SECRET_KEY` as Supabase secret
- [ ] Store `STRIPE_WEBHOOK_SECRET` as Supabase secret
- [ ] Register webhook endpoint in Stripe dashboard: `{SUPABASE_URL}/functions/v1/stripe-webhook`
- [ ] Enable Stripe Customer Portal in Stripe dashboard (Settings → Billing → Customer Portal)
- [ ] Set `APP_URL` as Supabase secret for redirect URLs
- [ ] Test entire flow in Stripe test mode before going live

---

## 8. Subscription_tier values (updated enum)

Current: `trial | free | pro | enterprise`
Add: `past_due`

Update the `salons` table check constraint and `lib/auth.types.ts` Role type accordingly.

---

## Out of Scope (build later)

- Yearly billing cycle
- Coupon / promo codes
- Multiple seats pricing
- Usage-based billing
- Admin UI for managing subscriptions
- Automated dunning emails (Stripe can handle these natively)
