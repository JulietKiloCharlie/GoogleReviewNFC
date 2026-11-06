# Google Review NFC Dashboard

Private dashboard for Syntrex Group Limited staff, plus one public review page per business. Adding a client writes a database row. It does not create a new site, repository, or deployment.

The NFC card stores a normal HTTPS link, for example `https://your-domain.example/dublin-coffee-house`.

## What is already built

- React, TypeScript, and Vite admin and public pages
- Supabase Auth for administrators, with optional authenticator-app MFA
- Postgres schema, row-level security, and a public page function that hides email addresses
- Logo storage rules
- Email verification and feedback delivery functions
- QR code and copy-link tools for NFC writing
- Tests for slugs, Google review links, rating behaviour, and the migration

## What is not live yet

GitHub does not provide Supabase, Cloudflare, or email credentials. No administrator password is included. The public site is not deployed until the steps below are finished and the resulting URL has been opened in a browser.

Free tiers used here:

- [Supabase](https://supabase.com/pricing) for auth, database, file storage, and the email functions
- [Cloudflare Pages](https://pages.cloudflare.com/) for the website
- [Resend](https://resend.com/pricing) for verification and feedback email

Supabase’s free project can pause after a period of inactivity. Resend’s free plan can send to any verified recipient only after you verify a sending domain. Both are one-time setup steps, not a per-client cost.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com/).
2. Open **Authentication → Providers → Email** and turn **off** public sign-up. Leave email auth on.
3. Open **Authentication → Sign In / Up** and enable **TOTP** multifactor authentication.
4. Open **Authentication → URL configuration**. Set the site URL to the production site when you have it. Add `http://localhost:5173/reset-password` and `https://YOUR-DOMAIN/reset-password` as redirect URLs.
5. Open **SQL Editor**, paste `supabase/migrations/20261106170000_init.sql`, and run it.
6. Open **Authentication → Users → Add user**. Create your own email and a password of at least 12 characters. Do not use a shared default password.
7. Run this in the SQL editor, with your real email:

```sql
insert into public.administrators (user_id, email)
select id, email from auth.users where email = 'you@syntrex.ie';
```

8. In **Project Settings → API**, copy the project URL and the `anon` public key.

## 2. Run it locally

```powershell
copy .env.example .env.local
npm install
npm run dev
```

Put the URL and anon key in `.env.local`:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_PUBLIC_SITE_URL=http://localhost:5173
```

Open `http://localhost:5173/login` and sign in. The service-role key must never go in this file.

## 3. Configure email

Customer feedback is sent to the business and is not saved in the database. Syntrex Group Limited is not copied.

1. Create a free Resend account.
2. Verify the domain you will send from, such as `syntrex.ie`.
3. Create an API key.
4. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), log in, and link this folder to the project:

```powershell
supabase login
supabase link
supabase secrets set RESEND_API_KEY=re_your_key EMAIL_FROM="Syntrex Group Limited <reviews@syntrex.ie>" APP_URL=https://YOUR-DOMAIN
supabase functions deploy send-feedback
supabase functions deploy request-email-verification
supabase functions deploy confirm-email
```

`APP_URL` must be the public site origin with no trailing slash. Verification links look like `https://YOUR-DOMAIN/verify-email#token`.

Until these secrets exist, publishing a page can succeed, but feedback delivery stays off and the dashboard says the verification email was not sent.

The business must open the verification email before private feedback works. Changing the address sends a new verification and does not switch delivery until the new address is confirmed.

Resend processes the message in order to deliver it. The public form says that.

## 4. Publish the website

1. In Cloudflare Pages, create a project from `JulietKiloCharlie/GoogleReviewNFC`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_SITE_URL` set to the final HTTPS origin
5. Deploy, then open the `pages.dev` URL and sign in.
6. When you want `reviews.syntrex.ie`, add that custom domain in Cloudflare and point DNS at it. Update `VITE_PUBLIC_SITE_URL`, `APP_URL`, and the Supabase redirect URLs, then redeploy the site and functions.

The files `public/_redirects` and `public/_headers` are included so page links and security headers work on Cloudflare Pages.

A business is not “published” in the dashboard until the database write succeeds and the public page can be read back.

## Google business search

On the add and edit forms, type a business name. Google’s Place Autocomplete returns a dropdown of matching listings. Choose one and the review link, name, and address fill in. The link is Google’s write-a-review address when it provides one, otherwise `https://search.google.com/local/writereview?placeid=PLACE_ID`. One Maps key covers every business. The NFC page address does not change. A review link can still be pasted by hand.

1. In Google Cloud, enable billing, **Maps JavaScript API**, and **Places API (New)**.
2. Create a browser API key restricted to those APIs and to `http://127.0.0.1:5173/*`, `http://localhost:5173/*`, and `https://julietkilocharlie.github.io/*`.
3. Put it in `.env.local` as `VITE_GOOGLE_MAPS_API_KEY` for this PC. For the live site, save the same value as the GitHub secret `GOOGLE_MAPS_API_KEY` and redeploy.
4. Run `supabase/migrations/20261106220000_google_place.sql` once in the Supabase SQL editor.

## 5. Add a client

1. Sign in.
2. Choose **Add Business**.
3. Type the business name, choose it from the Google dropdown, and add the business email. A review link can be pasted instead.
4. Add a PNG, JPG, or WebP logo if you have one. SVG is rejected.
5. Choose **Create & Publish**.
6. Copy the verified HTTPS URL.
7. In NFC Tools, write a URL/URI record with that link and test it on a second phone.

Accepted Google links:

- `https://search.google.com/local/writereview?placeid=...`
- `https://g.page/...`
- `https://maps.app.goo.gl/...`
- `https://www.google.ie/maps/...` and the same pattern on other Google country sites

The Google button opens that link. This app does not submit a review or ask for a Google password.

A 1-, 2-, or 3-star choice shows the private feedback form. A 4- or 5-star choice goes straight to the Google review page.

## Checks

```powershell
npm test
npm run build
```

GitHub Actions runs the same checks. Those checks do not prove the live site works. After deployment, sign in, publish a test business, open its URL on a phone, and confirm the verification email arrives.
