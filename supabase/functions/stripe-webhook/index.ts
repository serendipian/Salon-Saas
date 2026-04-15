// supabase/functions/stripe-webhook/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

class PermanentError extends Error {
  constructor(msg: string) { super(msg); this.name = 'PermanentError'; }
}

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency short-circuit: already processed?
  const { data: already } = await supabase
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (already) {
    console.log('Duplicate Stripe event, skipping:', event.id, event.type);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const salonId = session.metadata?.salon_id;
        if (!salonId || session.mode !== 'subscription') break;

        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        const { data: plans } = await supabase
          .from('plans')
          .select('id, name')
          .eq('stripe_price_id_monthly', stripeSubscription.items.data[0].price.id)
          .single();

        if (!plans) throw new PermanentError('Plan not found for price id');

        const PLAN_TIER: Record<string, string> = { premium: 'premium', pro: 'pro' };
        const tier = PLAN_TIER[plans.name.toLowerCase()] ?? 'premium';

        await supabase.from('subscriptions').upsert({
          salon_id: salonId,
          plan_id: plans.id,
          status: 'active',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          stripe_price_id: stripeSubscription.items.data[0].price.id,
          current_period_end: new Date(
            stripeSubscription.current_period_end * 1000,
          ).toISOString(),
        }, { onConflict: 'salon_id' });

        await supabase.from('salons')
          .update({ subscription_tier: tier, trial_ends_at: null })
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

        if (!plan) throw new PermanentError('Plan not found for price id (subscription.updated)');

        const PLAN_TIER: Record<string, string> = { premium: 'premium', pro: 'pro' };
        const tier = PLAN_TIER[plan.name.toLowerCase()] ?? 'premium';

        await supabase.from('subscriptions').update({
          status: sub.status === 'past_due' ? 'past_due' : 'active',
          stripe_price_id: sub.items.data[0].price.id,
          plan_id: plan.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);

        await supabase.from('salons')
          .update({
            subscription_tier: sub.status === 'past_due' ? 'past_due' : tier,
            trial_ends_at: null,
          })
          .eq('id', subscription.salon_id);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('id, salon_id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        if (!subscription) break;

        await supabase.from('invoices').upsert({
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
        }, { onConflict: 'stripe_invoice_id', ignoreDuplicates: true });

        await supabase.from('subscriptions').update({
          current_period_end: new Date(
            (invoice.lines.data[0]?.period.end ?? 0) * 1000,
          ).toISOString(),
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

    // Mark event as processed. This is idempotent — if a concurrent worker
    // already inserted, the UNIQUE on event_id raises, which we ignore.
    await supabase
      .from('processed_stripe_events')
      .insert({ event_id: event.id, event_type: event.type });

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Permanent errors: log, mark processed, return 200 so Stripe stops retrying.
    if (err instanceof PermanentError) {
      console.error('Permanent webhook error, not retrying:', event.id, err.message);
      await supabase
        .from('processed_stripe_events')
        .insert({ event_id: event.id, event_type: event.type });
      return new Response(
        JSON.stringify({ received: true, permanent_error: err.message }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Transient: 500 triggers Stripe retry.
    console.error('Webhook handler error, will retry:', event.id, err);
    return new Response(
      JSON.stringify({ error: 'Internal handler error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
