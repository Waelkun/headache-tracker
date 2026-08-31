# Supabase authentication setup

The application code and database are connected to the Supabase project `headache tracker` (`onzezageufsfqsbmacvb`). Complete these dashboard-only settings before production use.

## Email OTP

1. Open **Supabase Dashboard → Authentication → Email Templates → Magic Link**.
2. Keep the confirmation URL if you also want magic links, and add the six-digit token to the message body with `{{ .Token }}`.
3. In **Authentication → URL Configuration**, set the production Site URL after the Vercel deployment and add the local and production redirect URLs.

The app uses `signInWithOtp` followed by `verifyOtp`, so the user can paste the six-digit code from the email.

## Google sign-in

1. Create a Web OAuth client in Google Cloud Console.
2. Add the callback URL shown under **Supabase Dashboard → Authentication → Providers → Google** to the Google client's authorized redirect URIs.
3. Enter the Google Client ID and Client Secret directly in that Supabase provider page, then enable the provider.
4. Add the final Vercel URL to Supabase URL Configuration and the Google OAuth client's authorized JavaScript origins.

Do not commit the Google Client Secret to this repository.

## AI providers

1. Open **Supabase Dashboard → Edge Functions → Secrets**.
2. Add fresh server-side values for `GEMINI_API_KEY`, `NVIDIA_API_KEY`, and `OPENROUTER_API_KEY`.
3. Revoke any credential that was pasted into chat or committed anywhere before adding its replacement here.
4. Optional model overrides are `GEMINI_MODEL`, `NVIDIA_MODEL`, and `OPENROUTER_MODEL`.

The Edge Functions try Gemini first, NVIDIA second, and OpenRouter third. The browser never receives these API keys, and each answer includes the provider and exact model that produced it. If every configured provider fails, the app uses a limited on-device rule-based fallback so episode logging and basic data questions still work.
