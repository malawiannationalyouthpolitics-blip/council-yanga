<div align="center">
<img width="1200" height="475" alt="GHBanner" src="#" />
</div>

# Run and deploy your AI Studio app

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Supabase backend

Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` and run
the migration in `supabase/migrations/` against your project to get the
full schema, RLS policies and seed data.

### Monitor account provisioning (required for admins to add monitors)

Field monitors don't self-register — an admin adds them from the Admin
Dashboard, which needs to create a real Supabase Auth login for that
monitor. Creating another user's account requires the **service role
key**, which must never be shipped to the browser, so this is handled by
a small Edge Function instead of client code:

```bash
supabase functions deploy provision-monitor
```

No extra secrets to configure — `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are already injected into every Edge Function
automatically. Until this function is deployed, "Add Monitor" and "Reset
Credentials" in the Admin Dashboard will still update the local `monitors`
table but the monitor's login will fail against a live database.

### Creating admin accounts (public signup is disabled)

Admins do **not** self-register. The old Sign Up page/flow has been removed
from the app (see `src/views/SignupPage.tsx` and `signupAdminWithSupabase`
in `src/lib/supabaseAuth.ts` — both kept only for reference). To create an
admin account:

1. In the Supabase dashboard: **Authentication → Users → Add user**.
2. Enter the admin's email and a password, and check **Auto Confirm User**
   (otherwise they'll need to click a confirmation email first).
3. Leave "User Metadata" blank — the `handle_new_user` trigger in the
   migration defaults a new user's `profiles.role` to `'admin'` when no
   `role` is set in metadata. (Monitor accounts always pass `role: 'monitor'`
   explicitly via the `provision-monitor` function, so this default only
   ever applies to hand-created accounts — which is exactly what you want.)
   If you'd rather be explicit, set metadata to `{"role": "admin", "name": "Jane Doe"}`.
4. They can log in immediately with the email/password you set.

**Also lock the public signup endpoint itself**, not just the UI: in
**Authentication → Providers → Email**, turn off **Allow new users to
sign up**. Removing the Sign Up button from the app stops someone from
finding it, but the underlying `supabase.auth.signUp()` call is a public
endpoint reachable with just the anon key (which ships in the browser
bundle) until you disable it at the project level. This toggle only
affects public self-service signup — it does **not** affect the
`provision-monitor` Edge Function, which uses the service-role Admin API
and bypasses it by design.

### "Forgot password" (self-service reset)

Staff can trigger a reset from the login screen. This is a real two-step
Supabase Auth recovery flow, not a direct password change:

1. `resetPasswordWithSupabase()` calls `supabase.auth.resetPasswordForEmail()`,
   which emails the user a recovery link pointing at this app's origin.
2. Clicking that link lands back on the app with recovery tokens in the URL.
   The app listens for Supabase's `PASSWORD_RECOVERY` auth event
   (`src/App.tsx`) and shows `PasswordRecoveryModal`, which calls
   `supabase.auth.updateUser({ password })` to actually set the new
   password, then signs the (short-lived recovery) session out.

Because there's no client-side router, the recovery link always redirects
to the site root. For this to work in every environment you deploy to
(production domain, `*.vercel.app`, Preview deployments), make sure each
of those origins is present in **Supabase → Authentication → URL
Configuration → Redirect URLs** (a wildcard like
`https://your-project-*.vercel.app/**` covers Preview deployments) —
otherwise Supabase will reject the `redirectTo` and fall back to the
Site URL instead.

In offline/local sandbox mode (Supabase not configured) there's no email
to send, so the modal skips straight to collecting a new password and
updates the local `users` array directly.
