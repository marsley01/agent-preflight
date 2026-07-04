---
name: pre-deploy-checklist
description: Full pre-deploy quality gate for AI coding agents. Run before every deploy. Covers build, security, auth, database, error handling, rate limiting, payments, real-time cleanup, and deploy readiness. Stack-agnostic — works with any payment provider, any cloud, any region.
stack: any
---

# Pre-Deploy Checklist — Quality Gate for AI Agents

You are a senior full-stack engineer and security reviewer doing a final pass before this code ships to production. Go through every section below in order. For each item: **check it**, **fix it if broken**, and **mark it PASS or FAIL**. Do not skip sections. Do not mark PASS unless you have actually verified it. At the end, output a summary table.

---

## 0 — STACK CONTEXT (read first)

Identify which of these apply and note it before starting:

- [ ] Framework: Next.js App Router / Pages Router / Nuxt / SvelteKit / other
- [ ] Database: Supabase / PlanetScale / Neon / Firebase / Prisma ORM / raw SQL / other
- [ ] Auth: Supabase Auth / NextAuth / Clerk / Auth0 / Firebase Auth / other
- [ ] Payments: Stripe / Paystack / M-Pesa (Daraja/IntaSend) / Razorpay / PayPal / Paddle / other
- [ ] Real-time: Supabase Realtime / Stream Chat / Stream Video / Pusher / Ably / WebSockets / other
- [ ] Rate limiting: Upstash Redis / Cloudflare / express-rate-limit / in-memory / none
- [ ] Error tracking: Sentry / Datadog / LogRocket / BugSnag / none
- [ ] Hosting: Vercel / Netlify / Railway / Render / Fly.io / AWS / other

Adjust checks below to only test what applies. Skip irrelevant sections and note them as N/A.

---

## 1 — BUILD INTEGRITY

**Run these commands. If they error, stop and fix before continuing.**

```bash
# TypeScript — zero errors allowed
npx tsc --noEmit

# Linting
npx eslint . --ext .ts,.tsx --max-warnings 0

# Production build
npm run build
```

- [ ] `tsc --noEmit` exits with 0 errors
- [ ] ESLint exits with 0 warnings and 0 errors
- [ ] `npm run build` completes successfully — no build-time crashes
- [ ] No `@ts-ignore` or `any` types added without a comment explaining why
- [ ] No `console.log` left in production code (use a logger or remove)
- [ ] No `TODO` or `FIXME` comments blocking functionality

---

## 2 — ENVIRONMENT & SECRETS

**Nothing secret belongs in client-side code. Ever.**

- [ ] All `.env` files are in `.gitignore` — confirm with `git status`
- [ ] No secret keys or tokens are in any `NEXT_PUBLIC_` / client-exposed variable
- [ ] No database service role / admin keys are used in client components
- [ ] All payment provider **secret** keys are server-side only — only public/publishable keys go to the client
- [ ] All required env vars are documented in `.env.example` with placeholder values
- [ ] If deployed to Vercel / Railway / Render: confirm all env vars are set in the dashboard, not just locally
- [ ] No secrets committed in git history — run `git log --all --full-history -- "*.env"` to check

---

## 3 — AUTHENTICATION & AUTHORIZATION

**Every protected route and API endpoint must verify the user server-side.**

- [ ] Every API route checks for a valid session before executing any logic
- [ ] Server Actions (if used) validate session server-side — not just client-side guards
- [ ] Role checks (admin / moderator / paid user / etc.) are enforced server-side, not just hidden in the UI
- [ ] Protected pages redirect unauthenticated users — not just show an empty state
- [ ] Session tokens are never stored in `localStorage` — use cookies with `httpOnly` flag
- [ ] Auth redirect URLs are validated against an allowlist (no open redirects)
- [ ] Password reset and magic link flows verify the token before allowing any action

---

## 4 — DATABASE SAFETY

**Assume every user will try to read or write data that isn't theirs.**

- [ ] Row-level security or equivalent access control is enabled on every table holding user data
- [ ] Tested: can User A read or write User B's rows? (Should fail.)
- [ ] Admin/service credentials are only used in server-side admin operations — never in user-facing routes
- [ ] No `DELETE` or `UPDATE` runs without a `WHERE` clause scoped to the authenticated user
- [ ] Migrations are up to date — no schema drift between local and production
- [ ] Sensitive columns (tokens, payment refs, PII) are not returned in wildcard `SELECT *` queries reaching the client
- [ ] Soft deletes preferred over hard deletes for user data — allows recovery

---

## 5 — INPUT VALIDATION & SANITIZATION

**Never trust what comes in. Validate on the server every time.**

- [ ] All form inputs and API request bodies are validated with a schema (Zod / Yup / Joi) on the server
- [ ] File uploads: MIME type validated (not just extension), size is capped, file is never executed
- [ ] Any user-generated content rendered as HTML is sanitized (DOMPurify / sanitize-html) before render
- [ ] URL params and query strings used in DB queries are validated — no raw interpolation
- [ ] Phone number format is validated before passing to any SMS or payment provider
- [ ] Email fields are validated as proper email format server-side

---

## 6 — ERROR HANDLING

**Every operation that can fail must be handled. Silent failures are the worst bugs.**

### API Routes / Server
- [ ] Every `async` function in an API route is wrapped in `try/catch`
- [ ] Errors return proper HTTP status codes (400 bad input, 401 unauth, 403 forbidden, 404 not found, 500 server error) — not always 200
- [ ] Error responses return a consistent shape: `{ error: string, code?: string }` — no raw stack traces to the client
- [ ] Internal error details and stack traces never reach the client in production

### Client
- [ ] Every `fetch` / `axios` call has error handling with user-facing feedback
- [ ] Loading, error, and empty states are handled for every data-fetching component — no silent blank screens
- [ ] React Error Boundaries wrap high-risk sections (video calls, payment forms, real-time feeds)
- [ ] User always gets feedback when something goes wrong — toast, banner, or inline message

### AbortController & Cleanup
- [ ] Any `fetch` inside a `useEffect` creates an `AbortController` and aborts on cleanup
- [ ] Real-time sessions (video calls, chat) call their disconnect/leave method inside `useEffect` cleanup
- [ ] Real-time subscriptions are unsubscribed on component unmount

```typescript
// Correct pattern — verify this exists wherever you fetch inside useEffect
useEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal }).catch((err) => {
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
- [ ] OTP / verification code endpoints rate limited — max 5 attempts per 15 minutes
- [ ] AI / LLM endpoints rate limited per user — not just globally
- [ ] Payment trigger endpoints rate limited per user — prevent duplicate charges
- [ ] Webhook endpoints validate the provider signature before processing — not just any POST
- [ ] Rate limit responses return HTTP 429 with a `Retry-After` header

Suggested thresholds:
```
High sensitivity (auth, payments):  5 req / 60s
Medium (AI queries):               20 req / 60s
Low (general API):                100 req / 60s
```

---

## 8 — PAYMENT SAFETY

**Money flows are irreversible. Triple-check these regardless of provider.**

### All payment providers
- [ ] Webhook signature is verified using the provider's header before fulfilling any order
- [ ] Payment is verified server-side via the provider's verify endpoint — never trust client-side success callbacks alone
- [ ] Idempotency: duplicate webhook deliveries for the same reference/event ID are handled (check if already processed)
- [ ] Subscription plan / product IDs are stored server-side — client cannot self-assign a paid plan
- [ ] Refund logic requires elevated permissions (admin role or equivalent)
- [ ] Test mode credentials are never active in production — controlled by env var

### Stripe-specific
- [ ] Webhook handled via `stripe.webhooks.constructEvent()` — signature verified before any logic runs
- [ ] `payment_intent.succeeded` is used to fulfill orders — not just `checkout.session.completed`
- [ ] Customer portal enabled for subscription management — no manual cancel flows

### Paystack-specific
- [ ] Webhook validated using `x-paystack-signature` HMAC SHA-512 header
- [ ] Transaction verified via `GET /transaction/verify/:reference` before crediting user

### M-Pesa / Daraja / IntaSend-specific
- [ ] STK Push callback URL is HTTPS and server-side only
- [ ] Callback payload structure validated before updating any DB record
- [ ] Transaction status confirmed via query API before crediting — callback alone is not enough

### Paddle / Razorpay / other
- [ ] Follow the same pattern: verify signature → verify server-side → idempotency → no client trust

---

## 9 — SECURITY HEADERS & CORS

- [ ] CORS explicitly configured — `*` is not acceptable for authenticated APIs
- [ ] Allowed origins list only includes known, trusted domains — no wildcards
- [ ] Content Security Policy (CSP) header is set
- [ ] `X-Frame-Options: DENY` set to prevent clickjacking
- [ ] HTTPS enforced — no mixed content
- [ ] Cookies are `Secure`, `HttpOnly`, and `SameSite=Strict` or `Lax`

---

## 10 — REAL-TIME & SUBSCRIPTION CLEANUP

- [ ] Every subscription has a corresponding cleanup / unsubscribe in `useEffect` return
- [ ] Video/audio call sessions disconnect on component unmount — not only on button click
- [ ] Chat clients disconnect when the user logs out
- [ ] WebSocket connections are closed on unmount
- [ ] No subscriptions are set up inside event handlers — only inside `useEffect` with cleanup return

---

## 11 — PERFORMANCE BASICS

- [ ] Images are optimized and served with explicit dimensions — no layout shift (CLS)
- [ ] Large lists are paginated or virtualized — not loading hundreds of rows at once
- [ ] AI / LLM calls use streaming where possible — no 8-second blank spinners
- [ ] No `useEffect` runs on every render due to wrong dependency array
- [ ] Frequently filtered or sorted DB columns have indexes
- [ ] Heavy client-side libraries (3D, charts, editors) are lazy-loaded — not in the main bundle

---

## 12 — NOTIFICATIONS & BACKGROUND JOBS

- [ ] Push notification subscriptions stored per user — not globally
- [ ] Failed notifications do not crash the app — errors caught and logged silently
- [ ] Cron jobs / scheduled functions have error handling and alerting on failure
- [ ] Email sends are non-blocking — a failed email does not fail the user's primary action
- [ ] Background jobs are idempotent — safe to run twice without duplicating side effects

---

## 13 — LOGGING & OBSERVABILITY

- [ ] Error tracking (Sentry / Datadog / etc.) initialized and capturing unhandled errors in production
- [ ] Source maps uploaded so stack traces are readable — not minified
- [ ] Critical events (payments, auth, role changes) logged with enough context to debug
- [ ] No PII (names, emails, phone numbers, addresses) written to plain-text logs
- [ ] No payment card data or raw tokens written anywhere in logs

---

## 14 — DEPLOY READINESS

- [ ] Feature tested on mobile viewport (375px minimum)
- [ ] All new public-facing routes added to sitemap if applicable
- [ ] Database migrations ready to run in production
- [ ] Rollback plan defined: if this deploy breaks something, what is step 1?
- [ ] Correct branch is being deployed — no stale or experimental branches merged by accident
- [ ] No debug flags, test users, or seed data active in production config

---

## FINAL SUMMARY — OUTPUT THIS TABLE

| Section | Status | Issues Found |
|---|---|---|
| 1. Build Integrity | PASS / FAIL / N/A | — |
| 2. Env & Secrets | PASS / FAIL / N/A | — |
| 3. Auth & Authorization | PASS / FAIL / N/A | — |
| 4. Database Safety | PASS / FAIL / N/A | — |
| 5. Input Validation | PASS / FAIL / N/A | — |
| 6. Error Handling | PASS / FAIL / N/A | — |
| 7. Rate Limiting | PASS / FAIL / N/A | — |
| 8. Payment Safety | PASS / FAIL / N/A | — |
| 9. Security Headers | PASS / FAIL / N/A | — |
| 10. Real-time Cleanup | PASS / FAIL / N/A | — |
| 11. Performance | PASS / FAIL / N/A | — |
| 12. Notifications | PASS / FAIL / N/A | — |
| 13. Logging | PASS / FAIL / N/A | — |
| 14. Deploy Readiness | PASS / FAIL / N/A | — |

**If any row is FAIL: stop. Fix it. Re-run that section.**
**If all rows are PASS or N/A: ship it.**
