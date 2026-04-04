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
      success_url: `${appUrl}/settings?section=billing&success=true&plan=${encodeURIComponent(plan.name)}`,
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
