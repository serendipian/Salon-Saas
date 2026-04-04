// supabase/functions/expire-trials/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async () => {
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
