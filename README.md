# Vimen

Web app (Vite + React) for tradespeople, beauty/wellness professionals and other service providers to manage quotes, invoices, online payments, bookings and reviews in one place.

## Stack

- Vite 5 + React 18, routed with `react-router-dom`
- Clerk — auth
- Supabase — database + Edge Functions
- Resend (email) / Twilio (SMS), called via Supabase Edge Functions
- Custom i18n engine (`src/i18n/index.js`) — no external library. Supports `en` and `fr`. Interpolation uses `{{variable}}` only (no pluralization support — count-based strings are phrased count-agnostically, e.g. "1 review(s)")

## Pages

`/` — marketing homepage (logged-out visitors; skipped entirely in demo mode)
`/b/:slug` — public booking page (no auth required)

Once signed in: Dashboard, Jobs, Quotes, Clients, Invoices, Booking, Vimen Pay (payments), Marketplace, Reviews, Certifications, Referrals, Settings.

> Materials and Growth (revenue-model simulator) have been removed — both were either unreachable or scheduled for removal, and are not part of the app anymore.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev
```

Without `.env.local` filled in, the app runs in **demo mode** (fake seed data, no real auth) — useful for UI work, not for real usage.

### Environment variables (`.env.local`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLERK_PUBLISHABLE_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_APP_URL=http://localhost:5173
```

## Deployment

**1. Supabase — run migrations** (SQL Editor, in order):
```
supabase/migrations/001_schema.sql
supabase/migrations/002_marketplace.sql
supabase/migrations/003_payments.sql
```

**2. Supabase — deploy Edge Functions + secrets:**
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy create-payment-link
supabase functions deploy send-invoice-email
supabase functions deploy send-sms
supabase functions deploy stripe-webhook

supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set FROM_EMAIL=you@yourdomain.com
supabase secrets set FROM_NAME="Vimen"
supabase secrets set TWILIO_ACCOUNT_SID=AC...
supabase secrets set TWILIO_AUTH_TOKEN=...
supabase secrets set TWILIO_FROM_NUMBER=+1...
supabase secrets set APP_URL=https://your-app.vercel.app
```
(`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — no need to set them.)

**3. Vercel — deploy:**
```bash
vercel
vercel --prod
```
Set the same 5 env vars in Vercel → Project → Settings → Environment Variables, with live/production keys.

**4. Stripe — webhook:**
Add an endpoint in Stripe → Developers → Webhooks pointing to:
```
https://<your-project>.supabase.co/functions/v1/stripe-webhook
```

## Notes for contributors

- **Translations**: `src/i18n/en.js` and `src/i18n/fr.js` must stay in sync — same keys, same `{{placeholder}}` names, no duplicate top-level keys. When adding a page or string, add the key to both files in the same pass.
- **Buttons inside `<form>`**: always give raw `<button>` elements an explicit `type="button"` unless they're meant to submit — the shared `Btn` component already defaults to `type="button"`, but native `<button>` elements don't.
- **Demo mode**: `src/lib/supabase.js` degrades to a no-op stub client when Supabase env vars are missing, so the app never crashes on load without keys — but pages that call `lib/db.js` directly (rather than accepting `state`/`dispatch` props) will show empty states in demo mode instead of the seed data.
