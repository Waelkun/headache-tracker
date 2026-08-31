# Deploying to Vercel

The repo is deploy-ready: production Supabase values are baked into `.env.production`
(the **publishable** client key, which is safe to ship — Row Level Security protects the data),
and `vercel.json` handles SPA routing.

## One-time import (enables auto-deploy on every push)

1. Go to https://vercel.com/new
2. If prompted, **Install the Vercel GitHub App** and grant it access to the
   `Waelkun/headache-tracker` repository (private repos need this).
3. **Import** `Waelkun/headache-tracker`. Vercel auto-detects **Vite**
   (build `npm run build`, output `dist`). No env vars to add — they're in `.env.production`.
4. Click **Deploy**. From now on, every `git push` to `main` deploys automatically.

## After the first deploy — Supabase Auth URLs (required for login)

Copy your Vercel production URL (e.g. `https://headache-tracker-xxxx.vercel.app`), then in the
Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: set to the Vercel URL.
- **Redirect URLs**: add the Vercel URL (e.g. `https://headache-tracker-xxxx.vercel.app/**`).

This lets the email magic-link and Google sign-in resolve on the live domain. Until this is set,
sign-in works on `localhost` but not on the deployed site.

## Making changes later

Edit code locally → `git push` → Vercel rebuilds and redeploys automatically.
