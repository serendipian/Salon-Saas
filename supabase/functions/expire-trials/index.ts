// supabase/functions/expire-trials/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Fail-closed: require EXPIRE_TRIALS_SECRET to be configured. If it's
  // missing, the function is unauthenticated and anyone on the internet
  // could flip every trial salon to free. Refuse to run.
  const expectedSecret = Deno.env.get('EXPIRE_TRIALS_SECRET');
  if (!expectedSecret) {
    console.error('EXPIRE_TRIALS_SECRET is not configured — refusing to run');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const secret = req.headers.get('x-function-secret');
  if (secret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: expired, error } = await supabase
    .from('subscriptions')
    .select('salon_id')
    .eq('status', 'trial')
    .lt('trial_ends_at', new Date().toISOString());

  if (error) {
    console.error('Failed to fetch expired trials:', error);
    return new Response(
      JSON.stringify({ error: 'DB error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let count = 0;
  for (const { salon_id } of (expired ?? [])) {
    // Double-guarded update: only flip if still trial.
    const { data: subRes } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('salon_id', salon_id)
      .eq('status', 'trial') // guard: don't touch past_due or active
      .select('salon_id');

    if (!subRes || subRes.length === 0) {
      // Raced with an upgrade — skip the salon tier update entirely.
      continue;
    }

    // Only flip tier if still 'trial' — protects against race with a
    // just-completed Stripe upgrade that wrote tier='premium'/'pro'.
    await supabase
      .from('salons')
      .update({ subscription_tier: 'free' })
      .eq('id', salon_id)
      .eq('subscription_tier', 'trial');

    count++;
  }

  console.log(`Expired ${count} trials`);
  // Always return a generic body — do not leak count to unauthorized callers.
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
