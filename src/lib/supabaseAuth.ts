import { supabase, isSupabaseConfigured } from './supabaseClient';
import { defaultUsers, getStoredUsers, saveStoredUsers, type User, monitors as initialMonitors } from '../data';

export interface AuthResponse {
  user: User | null;
  error: string | null;
  // True when this login succeeded only against the local demo/mock user
  // list, not a real Supabase Auth account. The UI treats the person as
  // logged in, but there is no real session — so any write that depends on
  // Supabase recognizing them (RLS-gated table writes, the provision-monitor
  // Edge Function, etc.) will be rejected or silently no-op. Surfaced so the
  // UI can warn instead of producing confusing downstream errors.
  isLocalOnly?: boolean;
}

/**
 * Sign in a user via Supabase Auth (or local fallback if not configured).
 */
export async function loginWithSupabase(
  email: string,
  password: string,
  expectedRole?: 'admin' | 'monitor'
): Promise<AuthResponse> {
  const cleanEmail = email.trim().toLowerCase();

  if (!isSupabaseConfigured) {
    // Local / Offline fallback mode
    const users = getStoredUsers();
    const found = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
    if (!found) {
      return { user: null, error: 'Invalid email or password.' };
    }
    if (expectedRole && found.role !== expectedRole) {
      return { user: null, error: `This account is not registered as a ${expectedRole}.` };
    }
    return { user: found, error: null };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      // If user is in local default list and hasn't been migrated yet, provide helpful fallback
      const localUsers = getStoredUsers();
      const localMatch = localUsers.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
      if (localMatch) {
        console.warn(
          `Authenticated "${localMatch.name}" via local demo credentials only — no real Supabase account ` +
          `exists for ${cleanEmail}. Backend writes gated on a real session (adding monitors, saving ` +
          `projects, RLS-protected tables, etc.) will fail until a real account is created for this email ` +
          `(see README: "Creating admin accounts").`
        );
        // Clear out any unrelated real Supabase session that might still be
        // cached in this browser (e.g. from testing a different account
        // earlier). Left in place, its token would silently get attached to
        // subsequent authenticated calls — meaning that Edge Function/RLS
        // checks would run as THAT account, not the person now using this
        // local-only login, and fail with a confusing "not an admin" error
        // that has nothing to do with the wrong-looking account.
        await supabase.auth.signOut().catch(() => {});
        return { user: localMatch, error: null, isLocalOnly: true };
      }
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'User could not be found.' };
    }

    // Fetch profile from profiles table
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    let userRole: 'admin' | 'monitor' = (profile?.role as 'admin' | 'monitor') || 'admin';
    let monitorId: string | undefined = profile?.monitor_id;

    // Check if this is a monitor email
    if (!monitorId) {
      const { data: monitorRow } = await supabase
        .from('monitors')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (monitorRow) {
        userRole = 'monitor';
        monitorId = monitorRow.id;
      }
    }

    if (expectedRole && userRole !== expectedRole) {
      return { user: null, error: `Account role mismatch. Expected ${expectedRole}, got ${userRole}.` };
    }

    const appUser: User = {
      id: data.user.id,
      name: profile?.name || data.user.user_metadata?.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      password: '', // Kept secure on Supabase Auth server
      role: userRole,
      monitorId,
      joinDate: profile?.join_date || new Date().toISOString().slice(0, 10),
      photoUrl: profile?.photo_url || undefined,
    };

    return { user: appUser, error: null };
  } catch (err: any) {
    console.error('Supabase signIn error:', err);
    return { user: null, error: err?.message || 'Authentication failed' };
  }
}

/**
 * Sign up a new Admin account via Supabase Auth.
 *
 * UNUSED — kept for reference only. Public admin self-signup has been
 * intentionally disabled (see SignupPage.tsx and App.tsx); admins are now
 * created by hand in the Supabase dashboard. Also make sure "Enable email
 * signups" is turned off in Authentication > Providers > Email on the
 * Supabase project — removing the UI alone doesn't stop someone calling
 * `supabase.auth.signUp` directly with the public anon key.
 */
export async function signupAdminWithSupabase(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const cleanEmail = email.trim().toLowerCase();

  if (!isSupabaseConfigured) {
    const users = getStoredUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { user: null, error: 'An account with this email already exists.' };
    }
    const newUser: User = {
      id: `U-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      password,
      role: 'admin',
      joinDate: new Date().toISOString().slice(0, 10),
    };
    saveStoredUsers([...users, newUser]);
    return { user: newUser, error: null };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: name.trim(),
          role: 'admin',
        },
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'Failed to create user.' };
    }

    const newUser: User = {
      id: data.user.id,
      name: name.trim(),
      email: cleanEmail,
      password: '',
      role: 'admin',
      joinDate: new Date().toISOString().slice(0, 10),
    };

    // Ensure profile row exists
    await supabase.from('profiles').upsert({
      id: data.user.id,
      name: name.trim(),
      email: cleanEmail,
      role: 'admin',
      join_date: new Date().toISOString().slice(0, 10),
    });

    return { user: newUser, error: null };
  } catch (err: any) {
    console.error('Supabase signUp error:', err);
    return { user: null, error: err?.message || 'Registration failed' };
  }
}

/**
 * Trigger password reset for a user.
 *
 * In offline/local mode this sets the new password directly (there's no
 * email round-trip to do). When Supabase is configured, `newPassword` is
 * NOT applied here — this only sends the recovery email. The password is
 * actually changed later by `updatePasswordAfterRecovery()`, once the user
 * follows the emailed link back into the app and we get a real recovery
 * session (see the `PASSWORD_RECOVERY` listener in App.tsx).
 */
export async function resetPasswordWithSupabase(
  email: string,
  newPassword?: string
): Promise<{ success: boolean; error: string | null }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!isSupabaseConfigured) {
    if (newPassword) {
      const users = getStoredUsers();
      const updated = users.map(u => u.email.toLowerCase() === cleanEmail ? { ...u, password: newPassword } : u);
      saveStoredUsers(updated);
    }
    return { success: true, error: null };
  }

  try {
    // Explicit redirectTo so the recovery link comes back to this app
    // (root URL, since there's no client-side router / recovery route) no
    // matter what "Site URL" happens to be set to. This URL must also be
    // present in Supabase → Authentication → URL Configuration →
    // Redirect URLs, or Supabase will silently fall back to the Site URL.
    const redirectTo = typeof window !== 'undefined' ? window.location.origin + '/' : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, redirectTo ? { redirectTo } : undefined);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Password reset request failed' };
  }
}

/**
 * Completes a password recovery: called once the user has landed back in
 * the app via the emailed recovery link and Supabase has established a
 * short-lived recovery session (see the `PASSWORD_RECOVERY` auth event).
 * Updates the password on that session, then signs out so the user logs
 * back in normally with the new password.
 */
export async function updatePasswordAfterRecovery(
  newPassword: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Password recovery is only available when Supabase is configured.' };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, error: error.message };
    }
    // Don't leave the recovery session logged in silently — send the user
    // back through the normal login form with their new password.
    await supabase.auth.signOut();
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update password' };
  }
}

export interface ProvisionMonitorResult {
  success: boolean;
  userId?: string;
  error: string | null;
}

/**
 * Provision (or reset the password for) a monitor's real Supabase Auth login.
 *
 * This is the piece that was missing from the original migration: creating a
 * monitor's `auth.users` row requires the service-role key, which must never
 * ship to the browser. So instead of touching Auth directly, we call the
 * `provision-monitor` Edge Function (see supabase/functions/provision-monitor),
 * which runs server-side with the service role and verifies the caller is an
 * admin before doing anything.
 *
 * In offline/local mode (Supabase not configured) this is a no-op — the
 * existing local-fallback `User` array in `data.ts` already covers login.
 */
export async function provisionMonitorAccount(params: {
  action: 'create' | 'reset-password';
  monitorId: string;
  name: string;
  email: string;
  password: string;
}): Promise<ProvisionMonitorResult> {
  if (!isSupabaseConfigured) {
    // Nothing to provision server-side in offline mode — the caller's local
    // `users` array fallback already handles login for this case.
    return { success: true, error: null };
  }

  try {
    const { data, error } = await supabase.functions.invoke('provision-monitor', {
      body: {
        action: params.action,
        monitorId: params.monitorId,
        name: params.name,
        email: params.email.trim().toLowerCase(),
        password: params.password,
      },
    });

    if (error) {
      // supabase-js only gives a generic "Edge Function returned a non-2xx
      // status code" in `error.message` — the actual reason the function
      // returned (bad request, FK violation, admin check failed, etc.) is
      // in the JSON body of the failed HTTP response, available via
      // `error.context` (a Response) on FunctionsHttpError. Try to recover
      // it so the admin sees a real, actionable message instead.
      let detail: string | undefined;
      try {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.clone().json();
          detail = body?.error;
        }
      } catch {
        // Response body already consumed or not JSON — fall back below.
      }
      return { success: false, error: detail || error.message || 'Failed to provision monitor account.' };
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, userId: data?.userId, error: null };
  } catch (err: any) {
    console.error('provisionMonitorAccount error:', err);
    return { success: false, error: err?.message || 'Failed to provision monitor account.' };
  }
}

export interface SendCredentialsEmailResult {
  success: boolean;
  error: string | null;
  /** True when running offline/local — no email was actually sent. */
  skipped?: boolean;
}

/**
 * Actually dispatch the "here are your login credentials" email, via the
 * `send-credentials-email` Edge Function (Resend under the hood — see
 * supabase/functions/send-credentials-email).
 *
 * Previously nothing called anything here: the AdminDashboard "Monitor
 * Registered & Credentials Sent" screen was purely a UI mock (a setTimeout
 * that always reported success), so monitors were created but never told
 * their password. This is the real send.
 *
 * In offline/local mode (Supabase not configured) there's no server-side
 * function to call, so this is a no-op that reports `skipped: true` — the
 * UI should tell the admin to share the credentials manually in that case.
 */
export async function sendCredentialsEmail(params: {
  monitorName: string;
  monitorEmail: string;
  password: string;
  wards?: string;
  isResend?: boolean;
}): Promise<SendCredentialsEmailResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: null, skipped: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-credentials-email', {
      body: {
        monitorName: params.monitorName,
        monitorEmail: params.monitorEmail.trim().toLowerCase(),
        password: params.password,
        wards: params.wards,
        isResend: params.isResend,
      },
    });

    if (error) {
      let detail: string | undefined;
      try {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.clone().json();
          detail = body?.error;
        }
      } catch {
        // Response body already consumed or not JSON — fall back below.
      }
      return { success: false, error: detail || error.message || 'Failed to send credentials email.' };
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('sendCredentialsEmail error:', err);
    return { success: false, error: err?.message || 'Failed to send credentials email.' };
  }
}

/**
 * Sign out the current session
 */
export async function logoutWithSupabase(): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut error:', err);
    }
  }
}
