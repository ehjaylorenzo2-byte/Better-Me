# Better Me

A private, installable Progressive Web App for habit tracking, scheduling, gym
tracking, and personal finance (income, expenses, budget, savings, debt) --
built for a very small number of trusted users (e.g. you and one other
person), on 100% free infrastructure.

Stack: React + TypeScript + Vite, Supabase (Postgres + Auth + RLS), Web Push
via a Supabase Edge Function, installable as a PWA.

---

## 1. What's implemented

- Username/password auth (no email exposed to the user), private per-user data via Postgres Row Level Security.
- Habit tracker with recurrence (once/daily/weekly/monthly), lazily-materialized occurrences, Done/Skipped/Cancelled statuses only, recurring-edit history preservation ("this and future" via `supersedes_schedule_id`).
- Calendar with day drill-down and status indicators (icon + color, not color alone).
- Gym tracker with exercises, sets/reps/weight, and single-source-of-truth completion that also marks the linked Habit occurrence Done. Past/today/future edit rules enforced both in the UI and inside the `complete_workout` Postgres function.
- Finance: income, expenses, monthly budget (never silently clamped), savings with multiple independent categories + transaction history + goals, debt with multiple debts, validated payments, atomic balance updates via `record_debt_payment` / `record_savings_transaction` RPCs (no read-modify-write race).
- Home dashboard built entirely from real Supabase data (no fake numbers).
- Motivation/roast phrase library driven by actual done-rate and skip/cancel-rate.
- Light / Dark / System theme, persisted per user.
- PWA: manifest, service worker (precache + offline shell), installable, Web Push (1-hour-before reminders + 12PM Philippine daily summary) via a scheduled Supabase Edge Function.
- Asia/Manila is hardcoded as the business-logic timezone everywhere (see `src/utils/timezone.ts`), independent of the device's local timezone.
- Unit tests for the calculation, timezone, recurrence, and motivation logic (`npm test`).

### Known limitations (free-tier honesty)

- **Web Push on iOS** requires the PWA to be installed to the Home Screen first (Add to Home Screen) -- Safari does not support push for plain browser tabs. Once installed, iOS 16.4+ supports Web Push normally.
- **Background reminders** rely on a Supabase Edge Function you schedule to run every 5 minutes (Supabase's free tier scheduled Edge Functions, or `pg_cron`). There is no paid notification provider involved.
- The Edge Function's Postgres function calls re-check ownership manually (since it runs with the service role key) rather than relying on RLS -- documented inline in the SQL.

---

## 2. Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) account
- A free hosting account: [Vercel](https://vercel.com), [Netlify](https://netlify.com), or [Cloudflare Pages](https://pages.cloudflare.com) (pick one -- instructions below use Vercel, the other two are effectively identical: connect the repo, framework preset "Vite", build command `npm run build`, output directory `dist`)
- (Optional, for push notifications) the [Supabase CLI](https://supabase.com/docs/guides/cli)

---

## 3. Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see section 4). Then:

```bash
npm run dev
```

Open the printed local URL. The dev server is not a full PWA install target (installability requires a production build served over HTTPS or `vite preview`), but all app functionality works in dev once Supabase is configured.

---

## 4. Supabase project setup

1. Create a new project at [supabase.com](https://supabase.com) (free tier).
2. Project Settings -> API: copy the **Project URL** and **anon public key** into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Disable email confirmation** (this is a private app with synthetic internal emails, not real ones): Authentication -> Providers -> Email -> turn off "Confirm email".
4. **Database setup**: run every file in `supabase/migrations/` **in numbered
   order**, from `0001` upwards, either through the SQL Editor one at a time or
   with the CLI (`supabase link --project-ref YOUR_REF` then `supabase db push`).
   Each file is written to be safe to re-run, so a repeat is harmless.

   > **Do not use `supabase/SETUP.sql`.** It is a stale snapshot of `0001` and
   > `0002` only. A database built from it has no wallets, no savings entry
   > dates, none of the gym set tables and no `reminder_deliveries`, and it
   > still defines the superseded three-argument money RPCs — so reminders
   > answer `{"ok": true}` while silently sending nothing, and later migrations
   > fail on top of it. It is kept only until it can be deleted.
5. That's it for RLS -- every user-owned table already has Row Level Security enabled with `auth.uid() = user_id` policies from the migration. Nothing else to toggle.

### How username/password auth works without emails

Supabase Auth is email/password under the hood. Better Me builds a
deterministic internal alias from the chosen username --
`jordan` becomes `jordan@betterme.local` (configurable via
`VITE_AUTH_ALIAS_DOMAIN`) -- and uses that alias transparently. The user only
ever sees and types their username. Uniqueness is enforced by a unique index
on `profiles.username_normalized` plus a pre-signup availability check
(`is_username_available` RPC, safe for anonymous callers because it only
returns a boolean).

---

## 5. Web Push setup (optional but recommended)

1. Generate a VAPID key pair:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Put the **public** key in `.env.local` as `VITE_VAPID_PUBLIC_KEY` (and in your hosting provider's environment variables for production).

   > Vite bakes `VITE_*` values into the bundle **at build time**, so adding the
   > variable in Vercel is not enough on its own — you have to redeploy
   > afterwards or the shipped app will still have no key and the Enable button
   > will fail without saying why.
3. Deploy the reminder Edge Function:
   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT="mailto:you@example.com"
   ```
4. Schedule it to run every 5 minutes: Supabase Dashboard -> Edge Functions -> `send-reminders` -> Cron -> `*/5 * * * *`. (If your project doesn't have the Cron UI yet, use `pg_cron` + `pg_net` to `POST` the function URL on the same schedule -- both are free on Supabase's free tier.)
5. In the app, go to Profile -> Notification Settings -> **Enable Push Notifications** on each device that should receive reminders.

**What actually gets sent.** An hour before any scheduled habit, once per
schedule per day — a habit with a morning and an evening schedule gets both. A
midday list of everything still unmarked, sent once between 12:00 and 13:00
Philippine time. And an evening nudge between 20:00 and 21:00 on days with no
income or expense recorded at all, which is what the Finance reminders switch
controls. Every send is written to `reminder_deliveries` first and a unique
index makes a second send impossible, which is what allows a run to reach back
up to an hour and pick up anything a missed cron tick dropped.

Without this setup, the app still works fully -- you just won't get push reminders when the app isn't open.

---

## 6. Development

```bash
npm run dev       # start dev server
npm run test      # run unit tests (vitest)
npm run lint      # oxlint
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
```

---

## 7. Deployment (Vercel example)

1. Push this repo to GitHub (a **private** repo is recommended -- this is a personal app).
2. In Vercel: **Sign in with GitHub, using the same GitHub account that owns the repo.** If you keep a separate personal account from a work one, make sure you're signed into the right one in your browser first, or Vercel won't be able to see the repo.
3. New Project -> import the repo. `vercel.json` in this repo already pins the framework, build command (`npm run build`), output directory (`dist`), the SPA rewrite, and the correct service-worker cache headers, so you shouldn't need to change any build settings.
4. Add environment variables in Vercel's project settings (same keys as `.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_ALIAS_DOMAIN`, `VITE_VAPID_PUBLIC_KEY`, `VITE_APP_TIMEZONE`.
5. Deploy. Vercel's free tier is sufficient for a couple of private users.

> **Note on `VITE_` variables:** Vite bakes these into the JavaScript bundle at
> build time, so they are visible to anyone who views the deployed source. That
> is expected and safe here -- the Supabase anon key is a *public* key, and your
> data is protected by Row Level Security, not by hiding that key. Never put the
> Supabase **service role** key in a `VITE_` variable. Also note that changing an
> env var in Vercel requires a **redeploy** to take effect, since it is baked in
> at build time.

Netlify / Cloudflare Pages: same idea -- connect the repo, set the build command to `npm run build` and the publish/output directory to `dist`, add the same environment variables. `netlify.toml` and `public/_redirects` are already included for the Netlify path.

---

## 8. Installing the PWA on your phone

1. Open your deployed URL in the phone's browser (Safari on iOS, Chrome on Android).
2. **iOS (Safari):** tap the Share icon -> "Add to Home Screen".
3. **Android (Chrome):** tap the overflow menu -> "Install app" (or you'll see an automatic install banner).
4. Launch Better Me from the Home Screen icon -- it opens in standalone mode (no browser chrome).
5. When prompted (Profile -> Notification Settings), allow notifications to receive reminders.

To let another private user (e.g. your girlfriend) use the app: send them the same deployed URL. They tap "Create your account" and choose their own username/password -- their data is completely isolated from yours by Row Level Security.

---

## 9. Troubleshooting

- **"Supabase is not configured" console warning**: `.env.local` is missing or has placeholder values. Fill in the real Project URL and anon key.
- **Sign up fails with "already registered"**: the username is taken, or you disabled email confirmation but the project still requires it -- double check step 4.3 above.
- **Push notifications don't arrive**: confirm `VITE_VAPID_PUBLIC_KEY` is set in both `.env.local` (build time) and the deployed hosting provider's env vars, that the Edge Function is deployed with matching keys as secrets, and that it's actually scheduled to run (Supabase Dashboard -> Edge Functions -> Logs).
- **iOS push doesn't work**: the PWA must be installed to the Home Screen first; push does not work in a regular Safari tab.
- **Data doesn't show up for a fresh account**: this is expected -- Better Me never shows fake data. Add your first habit/expense/etc. and it will appear.
- **Build fails on `tsc -b`**: run `npm run build` locally first and fix any reported type errors before deploying; hosting providers will fail the same way.

---

## 10. Project structure

```
src/
  app/            route guards
  components/     shared UI kit (Button, Card, Input, Modal, etc.) + Logo
  features/auth/  auth context
  layouts/        app shell, bottom navigation
  lib/            supabase client, env
  pages/          one folder per feature area (auth, home, habits, calendar,
                   gym, finance, savings, debt, profile)
  services/       all Supabase reads/writes, one file per domain
  theme/          light/dark/system theme context
  types/          domain models + hand-authored Supabase Database type
  utils/          pure business logic: money, timezone, calculations,
                   recurrence, motivation phrases -- unit tested
  sw.ts           custom service worker source (Workbox precache + Web Push)
supabase/
  migrations/     SQL schema + RLS policies + RPC functions
  functions/      send-reminders Edge Function (1-hour + 12PM PH reminders)
tests/            vitest unit tests for the logic in src/utils and src/services
```

## 11. Replacing the logo

The caterpillar mark lives entirely in `src/components/Logo.tsx` as inline
SVG paths, plus the generated PWA icons in `public/icons/`. To swap in a
final logo asset, either edit the `<path>` data in `Logo.tsx`, or replace it
with an `<img src="/icons/your-logo.svg" />` -- no other UI code references
the logo directly, so this is a one-file change.
