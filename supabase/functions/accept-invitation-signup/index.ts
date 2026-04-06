import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: 'Token et mot de passe requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Le mot de passe doit contenir au moins 6 caractères' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch invitation info
    const { data: invInfo, error: invError } = await supabase
      .rpc('get_invitation_info', { p_token: token });

    if (invError) {
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la vérification de l\'invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const info = invInfo?.[0];
    if (!info || !info.is_valid) {
      return new Response(
        JSON.stringify({ error: 'Invitation invalide ou expirée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!info.staff_email) {
      return new Response(
        JSON.stringify({ error: 'Aucun email associé à ce membre. Demandez au gérant d\'ajouter votre email.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if a user with this email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === info.staff_email.toLowerCase()
    );

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: 'Un compte existe déjà avec cet email. Connectez-vous puis utilisez le lien d\'invitation.',
          existing: true,
          email: info.staff_email,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user with email_confirm: true (skips email verification)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: info.staff_email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: info.staff_first_name || '',
        last_name: info.staff_last_name || '',
      },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept invitation server-side (uses admin RPC, no auth.uid() needed)
    const { error: acceptError } = await supabase
      .rpc('accept_invitation_admin', { p_token: token, p_user_id: newUser.user.id });

    if (acceptError) {
      return new Response(
        JSON.stringify({ error: 'Compte créé mais erreur lors de l\'acceptation: ' + acceptError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ email: info.staff_email, userId: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
