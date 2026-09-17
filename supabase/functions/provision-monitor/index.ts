// ============================================================================
// Edge Function: provision-monitor
//
// Fills the gap flagged in the Supabase backend plan (Phase 3, step 8):
// "Monitors must still not self-signup ... an admin creates the monitor's
// auth.users row via the Supabase Admin API (service role, called from a
// secure server function/edge function — never from the browser)."
//
// This function:
//   1. Verifies the caller is signed in AND has role = 'admin' in `profiles`.
//   2. Creates (or, if the email already has an account, updates the
//      password of) the monitor's `auth.users` row via the Admin API.
//   3. Upserts the matching `profiles` row (role='monitor', monitor_id=...).
//   4. Links `monitors.user_id` to the new auth user id.
//
// Deploy:   supabase functions deploy provision-monitor
// Secrets:  SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
//           injected automatically by Supabase for every Edge Function — no
//           manual secret configuration needed.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProvisionMonitorPayload {
  action: 'create' | 'reset-password';
  monitorId: string;
  name?: string;
  email: string;
  password: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Function is missing required Supabase environment variables.' }, 500);
  }

  try {
    // ------------------------------------------------------------------
    // 1. Verify the caller is an authenticated admin.
    //    We never trust a role claimed by the client — we look it up
    //    server-side with the service role key.
    // ------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return json({ error: 'Missing Authorization header.' }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser(jwt);

    if (callerErr || !caller) {
      return json({ error: 'Invalid or expired session.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: callerProfileErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfileErr || callerProfile?.role !== 'admin') {
      return json({ error: 'Only Council Administrators can provision monitor accounts.' }, 403);
    }

    // ------------------------------------------------------------------
    // 2. Validate payload.
    // ------------------------------------------------------------------
    const payload = (await req.json()) as ProvisionMonitorPayload;
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;
    const monitorId = payload.monitorId;

    if (!email || !password || !monitorId) {
      return json({ error: 'email, password and monitorId are required.' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters.' }, 400);
    }

    // ------------------------------------------------------------------
    // 2b. Safety net: guarantee the `monitors` row exists BEFORE we touch
    // auth/profiles. `profiles.monitor_id` has a foreign-key constraint on
    // `monitors(id)`, so if the frontend's own write of the monitor record
    // hasn't landed in Postgres yet (a race between saving the monitor and
    // provisioning their login), creating the auth user's `profiles` row
    // fails with a FK violation and the whole request 500s. This upsert
    // uses `ignoreDuplicates`, so if the real monitor row already exists it
    // is never touched or overwritten — this only fills the gap when it's
    // missing.
    const { error: monitorStubErr } = await admin.from('monitors').upsert(
      { id: monitorId, name: payload.name || email.split('@')[0], email, wards: 'Unassigned' },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (monitorStubErr) {
      return json({ error: `Could not verify monitor record before provisioning: ${monitorStubErr.message}` }, 500);
    }

    // Helper: find an existing auth.users row by email (Admin API has no
    // "get by email" call, so we page through listUsers).
    async function findAuthUserByEmail(targetEmail: string) {
      let page = 1;
      const perPage = 200;
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const match = data.users.find(u => u.email?.toLowerCase() === targetEmail);
        if (match) return match;
        if (data.users.length < perPage) return null;
        page += 1;
      }
    }

    // ------------------------------------------------------------------
    // 3a. Reset password for an existing monitor account.
    // ------------------------------------------------------------------
    if (payload.action === 'reset-password') {
      const existing = await findAuthUserByEmail(email);
      if (!existing) {
        return json({ error: `No auth account found for ${email}. Try "Add Monitor" instead.` }, 404);
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, { password });
      if (updateErr) return json({ error: updateErr.message }, 500);

      await admin
        .from('profiles')
        .upsert({ id: existing.id, name: payload.name || email.split('@')[0], email, role: 'monitor', monitor_id: monitorId });
      await admin.from('monitors').update({ user_id: existing.id }).eq('id', monitorId);

      return json({ success: true, userId: existing.id });
    }

    // ------------------------------------------------------------------
    // 3b. Create a new monitor account (default action).
    // ------------------------------------------------------------------
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: payload.name, role: 'monitor', monitor_id: monitorId },
    });

    if (createErr) {
      // Re-adding a monitor whose email already has an auth account:
      // treat it the same as a password reset instead of failing.
      const alreadyExists = /already|exists|registered/i.test(createErr.message);
      if (alreadyExists) {
        const existing = await findAuthUserByEmail(email);
        if (existing) {
          const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, { password });
          if (updateErr) return json({ error: updateErr.message }, 500);

          await admin
            .from('profiles')
            .upsert({ id: existing.id, name: payload.name || email.split('@')[0], email, role: 'monitor', monitor_id: monitorId });
          await admin.from('monitors').update({ user_id: existing.id }).eq('id', monitorId);

          return json({ success: true, userId: existing.id, reused: true });
        }
      }
      return json({ error: createErr.message }, 500);
    }

    const newUserId = created.user.id;

    // The `on_auth_user_created` trigger (see init_schema.sql) already inserts
    // a matching `profiles` row from user_metadata — this upsert just makes
    // sure it's correct even if the trigger is ever removed or races.
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: newUserId,
      name: payload.name || email.split('@')[0],
      email,
      role: 'monitor',
      monitor_id: monitorId,
    });
    if (profileErr) return json({ error: profileErr.message }, 500);

    const { error: linkErr } = await admin.from('monitors').update({ user_id: newUserId }).eq('id', monitorId);
    if (linkErr) return json({ error: linkErr.message }, 500);

    return json({ success: true, userId: newUserId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});
