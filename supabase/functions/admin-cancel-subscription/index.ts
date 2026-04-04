// supabase/functions/admin-cancel-subscription/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  // Service role client — for privileged DB reads
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // User client — to verify JWT identity
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // Verify is_admin via service role (bypasses RLS)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return new Response('Forbidden', { status: 403 });

  const body = await req.json().catch(() => null);
  const { salon_id } = body ?? {};
  if (!salon_id) {
    return new Response(
      JSON.stringify({ error: 'salon_id required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Find active Stripe subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('salon_id', salon_id)
    .eq('status', 'active')
    .not('stripe_subscription_id', 'is', null)
    .single();

  if (!subscription?.stripe_subscription_id) {
    return new Response(
      JSON.stringify({ error: 'No active Stripe subscription found for this salon' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Cancel in Stripe — existing stripe-webhook handles customer.subscription.deleted → DB update
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
