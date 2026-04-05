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

        // 'Premium' plan → 'premium' tier, 'Pro' plan → 'pro' tier
        const PLAN_TIER: Record<string, string> = { premium: 'premium', pro: 'pro' };
        const tier = PLAN_TIER[plans?.name?.toLowerCase() ?? ''] ?? 'premium';

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

        const PLAN_TIER: Record<string, string> = { premium: 'premium', pro: 'pro' };
        const tier = PLAN_TIER[plan?.name?.toLowerCase() ?? ''] ?? 'premium';

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
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
