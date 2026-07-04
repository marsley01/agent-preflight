---
name: ship-checklist
description: Pre-ship quality gate for every feature, page, or full app. Run this before every deploy. If any section has a FAIL, stop and fix before proceeding. Covers build integrity, security, error handling, rate limiting, database safety, auth, payments, real-time cleanup, and deploy readiness.
---

# Ship Checklist — Pre-Deploy Quality Gate

You are a senior full-stack engineer and security reviewer doing a final pass before this code ships to production. Go through every section below in order. For each item: **check it**, **fix it if broken**, and **mark it PASS or FAIL**. Do not skip sections. Do not mark PASS unless you have actually verified it. At the end, output a summary table.

---

## 0 — STACK CONTEXT (read first)

Before you start, identify which of these apply to this project and note it:

- [ ] Framework: Next.js App Router / Pages Router / other
- [ ] Database: Supabase / Prisma / raw SQL / other
- [ ] Auth: Supabase Auth / NextAuth / Clerk / other
- [ ] Payments: Paystack / M-Pesa (IntaSend/Daraja) / Stripe / other
- [ ] Real-time: Supabase Realtime / Stream Chat / Stream Video / WebSockets / other
- [ ] Rate limiting: Upstash Redis / in-memory / none
- [ ] Error tracking: Sentry / LogRocket / none

Adjust the checks below to only test what applies. Skip irrelevant sections but note them as N/A.

---

## 1 — BUILD INTEGRITY

**Run these commands. If they error, stop everything and fix before continuing.**

```bash
# TypeScript — zero errors allowed
npx tsc --noEmit

# Linting
npx eslint . --ext .ts,.tsx --max-warnings 0

# Production build
npm run build
```

Checklist:
- [ ] `tsc --noEmit` exits with 0 errors
- [ ] ESLint exits with 0 warnings and 0 errors
- [ ] `npm run build` completes successfully — no build-time crashes
- [ ] No `@ts-ignore` or `any` types added without a comment explaining why
- [ ] No `console.log` left in production code (use a logger or remove)
- [ ] No hardcoded `TODO` or `FIXME` comments blocking functionality

---

## 2 — ENVIRONMENT & SECRETS

**Nothing secret belongs in client-side code. Ever.**

- [ ] All `.env` files are in `.gitignore` — confirm with `git status`
- [ ] No API keys, secret tokens, or passwords are in any `NEXT_PUBLIC_` variable
- [ ] No Supabase `service_role` key is used in client components or exposed to the browser
- [ ] M-Pesa / Daraja consumer secret is server-side only
- [ ] Paystack secret key is server-side only — only the public key goes to the client
- [ ] All required env vars are documented in `.env.example` with placeholder values
- [ ] If using Vercel/Render/Railway: confirm all env vars are set in the deployment dashboard, not just locally

---

## 3 — AUTHENTICATION & AUTHORIZATION

**Every protected route and API endpoint must verify the user.**

- [ ] Every API route (`/api/**`) checks for a valid session before doing anything
- [ ] Server Actions (if used) validate session server-side — not just client-side guards
- [ ] Role checks (admin, tutor, student, etc.) are enforced server-side, not just hidden in the UI
- [ ] Protected pages redirect unauthenticated users — not just show empty state
- [ ] JWT tokens / session tokens are never stored in `localStorage` — use cookies with `httpOnly` flag
- [ ] Auth callbacks and redirect URLs are validated against an allowlist (no open redirects)
- [ ] Password reset and email verification flows require the user to be in the correct state before proceeding

---

## 4 — DATABASE & SUPABASE SAFETY

**RLS is your last line of defense. Treat it like a seatbelt — always on.**

- [ ] Row Level Security (RLS) is ENABLED on every table that holds user data
- [ ] Every RLS policy has been tested: can User A read or write User B's rows? (It should fail)
- [ ] The `service_role` key is only used in server-side admin operations — never in a client or edge function accessible to users
- [ ] No direct `DELETE` or `UPDATE` queries run without a `WHERE` clause scoped to the authenticated user's ID
- [ ] Migrations are up to date — no schema drift between local and production
- [ ] Sensitive columns (passwords, payment refs, PII) are not returned in wildcard `SELECT *` queries that reach the client
- [ ] If using Prisma: confirm queries are not bypassing RLS via the service client where they shouldn't be

---

## 5 — INPUT VALIDATION & SANITIZATION

**Never trust what comes in. Validate on the server, every time.**

- [ ] All form inputs and API request bodies are validated with a schema (Zod preferred) on the server
- [ ] File uploads: type is validated (not just extension), size is limited, file is not executed
- [ ] Any content that gets rendered as HTML (user-generated descriptions, bios, etc.) is sanitized with DOMPurify or equivalent before render
- [ ] URL parameters and query strings used in DB queries are validated — no raw interpolation
- [ ] Email fields are validated as real email format
- [ ] Phone numbers for M-Pesa are validated as Kenyan format (`254XXXXXXXXX`) before STK push

---

## 6 — ERROR HANDLING

**Every operation that can fail must be handled. Silence is the worst bug.**

### API Routes / Server Actions
- [ ] Every `async` function in an API route is wrapped in `try/catch`
- [ ] Errors return a proper HTTP status code (400 for bad input, 401 for unauth, 403 for forbidden, 404 for not found, 500 for server error) — not always 200
- [ ] Error responses return a consistent shape: `{ error: string, code?: string }` — not raw stack traces
- [ ] Stack traces and internal error messages are never sent to the client in production

### Client Side
- [ ] Every `fetch` / `axios` call has `.catch()` or is in a `try/catch` with user-facing error feedback
- [ ] Loading, error, and empty states are all handled for every data-fetching component — no silent blank screens
- [ ] React Error Boundaries are in place around high-risk sections (video calls, payment forms, real-time feeds)
- [ ] Toast / alert notifications show on errors — user always knows something went wrong

### AbortController
- [ ] Any `fetch` inside a `useEffect` creates an `AbortController` and aborts on cleanup
- [ ] Stream sessions (Stream Video / Stream Chat) call `.leave()` / `.disconnect()` inside the `useEffect` cleanup function — not inside an event handler only
- [ ] Real-time subscriptions (Supabase Realtime channels) are unsubscribed on component unmount

```typescript
// Correct pattern — verify this exists wherever you fetch in useEffect
useEffect(() => {
  const controller = new AbortController();
  fetchSomething({ signal: controller.signal }).catch((err) => {
    if (err.name === 'AbortError') return; // expected, ignore
    setError(err.message);
  });
  return () => controller.abort();
}, [dependency]);
```

---

## 7 — RATE LIMITING

**Every public-facing endpoint needs protection against abuse.**

- [ ] Auth endpoints (login, register, password reset) are rate limited — max attempts per IP per minute
- [ ] OTP / verification code endpoints are rate limited — max 5 attempts per 15 minutes
- [ ] AI endpoints (OpenRouter, Claude, etc.) are rate limited per user — not just globally
- [ ] M-Pesa STK Push endpoints are rate limited per user — prevent duplicate triggers
- [ ] Paystack webhook endpoint validates the signature before processing — not just any POST
- [ ] Rate limit responses return HTTP 429 with a `Retry-After` header

If using Upstash Redis, verify the sliding window config matches the sensitivity of the endpoint:

```typescript
// High-sensitivity (auth, payments): 5 requests / 60 seconds
// Medium (AI queries): 20 requests / 60 seconds
// Low (general API): 100 requests / 60 seconds
```

---

## 8 — PAYMENT SAFETY

**Money flows are irreversible. Triple-check these.**

### Paystack
- [ ] Webhook signature is verified using `x-paystack-signature` header before any order is fulfilled
- [ ] Payment verification calls Paystack's verify endpoint server-side — never trust client-side success callback alone
- [ ] Idempotency: duplicate webhook deliveries for the same `reference` are handled (check if already processed before acting)
- [ ] Subscription plan IDs are stored server-side — client cannot self-assign a premium plan
- [ ] Refund logic (if any) requires admin role

### M-Pesa / Daraja / IntaSend
- [ ] STK Push callback URL is HTTPS and server-side
- [ ] Callback handler validates the incoming payload structure before updating any DB record
- [ ] Transaction status is confirmed via query API before crediting a user — don't trust the callback alone
- [ ] Sandbox credentials are never active in production — mode switch is enforced by env var, not manual toggle

---

## 9 — SECURITY HEADERS & CORS

**A misconfigured CORS policy is an open door.**

- [ ] CORS is explicitly configured — `*` is not acceptable for authenticated APIs
- [ ] Allowed origins list only includes known, trusted domains (your frontend URL, not a wildcard)
- [ ] Content Security Policy (CSP) header is set — even a basic one blocks XSS
- [ ] `X-Frame-Options: DENY` is set to prevent clickjacking
- [ ] HTTPS is enforced — no mixed content (HTTP resources on HTTPS pages)
- [ ] Cookies are `Secure`, `HttpOnly`, and `SameSite=Strict` or `Lax`

In Next.js, verify `next.config.js` has a `headers()` block or middleware sets these.

---

## 10 — REAL-TIME & SUBSCRIPTION CLEANUP

**Leaked subscriptions cause silent memory/billing/state bugs.**

- [ ] Every Supabase `channel.subscribe()` has a corresponding `supabase.removeChannel()` in cleanup
- [ ] Stream Video: `call.leave()` is called in `useEffect` cleanup — not only on button click
- [ ] Stream Chat: `client.disconnectUser()` is called when the user logs out or the component unmounts
- [ ] WebSocket connections are closed on unmount
- [ ] No subscriptions are set up inside event handlers — only inside `useEffect` with cleanup

---

## 11 — PERFORMANCE BASICS

**Slow is broken for Kenyan mobile users on 3G.**

- [ ] Images use `next/image` with explicit `width` and `height` — no layout shift
- [ ] Large lists are paginated or virtualized — not loading 500 rows at once
- [ ] AI/LLM calls use streaming where possible — don't make users stare at a spinner for 8 seconds
- [ ] No `useEffect` runs on every render due to a missing or wrong dependency array
- [ ] Database queries use indexes on columns that are filtered or sorted frequently
- [ ] Heavy client-side JS (Three.js, charts, etc.) is lazy-loaded — not in the main bundle

---

## 12 — NOTIFICATIONS & BACKGROUND JOBS

- [ ] Web push notification subscription is stored per user — not globally
- [ ] Push notification service worker handles errors gracefully — a failed notification does not crash the app
- [ ] Cron jobs / scheduled functions have error handling and send alerts on failure
- [ ] Email sends (Resend, Nodemailer, etc.) are non-blocking — a failed email does not fail the user's primary action

---

## 13 — LOGGING & OBSERVABILITY

- [ ] Sentry (or equivalent) is initialized and capturing unhandled errors in production
- [ ] Source maps are uploaded to Sentry so stack traces are readable — not minified gibberish
- [ ] Critical payment and auth events are logged with enough context to debug (user ID, amount, reference — never card numbers or passwords)
- [ ] No PII (names, emails, phone numbers) is written to plain-text logs

---

## 14 — DEPLOY READINESS

**Final checks before you push the button.**

- [ ] Feature has been tested on mobile viewport (375px width minimum)
- [ ] Feature works without JavaScript disabled for critical flows (or gracefully degrades)
- [ ] All new routes are included in the sitemap (if public-facing)
- [ ] Database migrations are ready to run in production — not just local
- [ ] Rollback plan exists: if this deploy breaks something, what is step 1?
- [ ] No stale AI-agent-created branches are being merged accidentally — confirm the correct branch
- [ ] PR has been reviewed or self-reviewed against the SCOPE.md for the feature

---

## FINAL SUMMARY — OUTPUT THIS TABLE

After completing all checks, output this table:

| Section | Status | Issues Found |
|---|---|---|
| 1. Build Integrity | PASS / FAIL | — |
| 2. Env & Secrets | PASS / FAIL | — |
| 3. Auth & Authorization | PASS / FAIL | — |
| 4. Database Safety | PASS / FAIL | — |
| 5. Input Validation | PASS / FAIL | — |
| 6. Error Handling | PASS / FAIL | — |
| 7. Rate Limiting | PASS / FAIL | — |
| 8. Payment Safety | PASS / FAIL | — |
| 9. Security Headers | PASS / FAIL | — |
| 10. Real-time Cleanup | PASS / FAIL | — |
| 11. Performance | PASS / FAIL | — |
| 12. Notifications | PASS / FAIL | — |
| 13. Logging | PASS / FAIL | — |
| 14. Deploy Readiness | PASS / FAIL | — |

**If any row is FAIL: do not deploy. Fix and re-run that section.**

**If all rows are PASS or N/A: ship it.**
