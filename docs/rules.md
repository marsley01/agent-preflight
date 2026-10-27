# Rule reference

Every finding the CLI can report, grouped by category. The **rule ID** is what appears in `--format json` (`id`), in SARIF (`ruleId`), and in GitHub Code Scanning.

- **Status:** `fail` is a definite problem. `warn` is a likely problem or a missing safeguard.
- **Severity:** sets the exit code with `--fail-on` and the score. The score loses −25 for critical, −10 high, −4 medium, −1 low, once per rule, and warnings count half.
- **Suppress** a finding with a `preflight-ignore` comment on the line or the line above. Exclude whole paths in `.preflightignore`. See [Suppressing findings](../packages/cli/README.md#suppressing-findings).

Passing checks and "not applicable" results (`*/not-applicable`, `info`) are not listed here. They never fail a build.

> Contributors: `packages/cli/test/docs.test.mjs` fails if a rule ID in the source is missing from this page.

---

## Secrets (`--only security`)

The scanner looks for credential **values**, not variable names, so reading `process.env.STRIPE_SECRET_KEY` on the server is fine. Snippets are redacted in every output format. Local `.env` files are skipped for value matching because they're meant to hold secrets; whether they are *committed* is checked separately through git.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `secrets/aws-access-key` | fail | critical | AWS access key IDs (`AKIA…`, `ASIA…`) |
| `secrets/github-token` | fail | critical | GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) |
| `secrets/stripe-live-key` | fail | critical | Stripe live secret or restricted keys (`sk_live_`, `rk_live_`) |
| `secrets/stripe-test-key` | fail | medium | Stripe test secret keys (`sk_test_`) |
| `secrets/anthropic-key` | fail | critical | Anthropic API keys (`sk-ant-…`) |
| `secrets/openai-key` | fail | critical | OpenAI API keys (`sk-proj-…`, `sk-svcacct-…`, legacy `sk-…`) |
| `secrets/google-api-key` | fail | high | Google API keys (`AIza…`) |
| `secrets/slack-token` | fail | high | Slack tokens (`xoxb-`, `xoxp-`, …) |
| `secrets/sendgrid-key` | fail | high | SendGrid API keys (`SG.…`) |
| `secrets/resend-key` | fail | high | Resend API keys (`re_…`) |
| `secrets/private-key` | fail | critical | PEM private key blocks (RSA, EC, OpenSSH, PGP, …) |
| `secrets/db-url-password` | fail | high | `postgres://`, `mysql://`, `mongodb://` or `redis://` URLs with an embedded password for a non-local host |
| `secrets/supabase-service-role-jwt` | fail | critical | A JWT whose payload has `"role": "service_role"`. This is the Supabase admin key and it bypasses all RLS |
| `secrets/public-env-secret` | fail | high | Secret-looking env vars with a public prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_`, `PUBLIC_`, `NUXT_PUBLIC_`, `GATSBY_`), read in code or assigned in a `.env*` file. Frameworks inline these into the browser bundle |
| `secrets/service-role-client` | fail | critical | The Supabase service role key read from code that ships to the browser |
| `secrets/env-committed` | fail | critical | A `.env` / `.env.local` / `.env.production` file tracked by git. Templates like `.env.example` are fine |
| `secrets/env-gitignored` | fail / warn | high / medium | `.env` is not gitignored (fail), or there's no `.gitignore` at all (warn) |
| `secrets/env-example` | warn | low | No `.env.example` documenting the required variables |

**Fixing a leaked key:** removing it from the code is not enough. Revoke and rotate it with the provider, then purge it from git history (`git filter-repo` or BFG). Bots scrape public commits for keys within minutes.

**What counts as client code:** files starting with `'use client'`, files under `components/`, `hooks/` or `client/`, and everything under `src/` in a Vite or Create React App project. Files under `api/`, `server/` or `functions/`, `*.server.ts`, and files with `'use server'` or `import 'server-only'` are treated as server code. In monorepos, the nearest `package.json` decides the framework.

## Code Vulnerabilities (`--only vulnerabilities`)

Line-level patterns in first-party source. Tests, fixtures, `*.d.ts`, minified files and build output are skipped. Text inside string and regex literals is ignored unless the rule needs it, so documentation strings don't trigger findings. Each rule reports at most 10 locations, then a "…and N more" summary.

| Rule ID | Status | Severity | Detects | Fix |
|---|---|---|---|---|
| `injection/sql-template` | fail | critical | `.query()`, `.execute()`, `.raw()`, `whereRaw()`, `$queryRawUnsafe()` … called with a template literal containing `${…}` | Parameterized queries (`$1`) or a tagged template (`sql\`…\``, `prisma.$queryRaw\`…\``) |
| `injection/sql-concat` | fail | critical | `SELECT`/`INSERT`/`UPDATE`/`DELETE` strings concatenated with `+` into a query call | Parameterized queries |
| `injection/prisma-unsafe` | warn | high | Any `$queryRawUnsafe` / `$executeRawUnsafe` call | Use the tagged-template `$queryRaw` |
| `injection/command` | fail | critical | `exec()` / `execSync()` with interpolation or concatenation, in files that import `child_process`, `execa` or `shelljs` | `execFile`/`spawn` with an argument array |
| `injection/shell-true` | warn | medium | `shell: true` passed to a child process | Drop it and pass an argument array |
| `injection/eval` | fail | high | `eval(…)` and `new Function(…)` | Remove dynamic evaluation |
| `xss/dangerously-set-inner-html` | warn | medium | `dangerouslySetInnerHTML={{ __html: … }}` in a file without DOMPurify or sanitize-html | Sanitize first, or render as text |
| `xss/inner-html` | warn | medium | `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML()`, `document.write()` | `textContent`, or sanitize |
| `xss/vue-v-html` | warn | medium | Vue `v-html` / Svelte `{@html}` without a sanitizer | Sanitize with DOMPurify |
| `tls/verification-disabled` | fail | high | `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` | Remove it; pass a custom `ca` for self-signed certs |
| `jwt/alg-none` | fail | critical | `algorithms` lists that include `"none"` | Pin the expected algorithm |
| `jwt/decode-without-verify` | warn | high | `jwt.decode()` / `jwtDecode()` in a file with no `verify`, `jwtVerify`, `getUser` or `getClaims` | Verify the signature before trusting claims |
| `jwt/ignore-expiration` | warn | medium | `ignoreExpiration: true` | Short-lived tokens with refresh rotation |
| `cors/wildcard-with-credentials` | fail | high | `origin: '*'` or `origin: true` in a file that also enables credentials | An explicit origin allowlist |
| `ssrf/user-controlled-url` | warn | high | `fetch`/`axios`/`got` called directly with request input (`req.query`, `searchParams.get()`, …) | Allowlist hosts and block private IP ranges |
| `redirect/open-redirect` | warn | medium | `redirect()` / `res.redirect()` / `NextResponse.redirect()` with request input | Relative paths or an allowlist only |
| `path/traversal` | warn | high | `readFile`, `createReadStream`, `sendFile`, `unlink`, `writeFile` with request input | Resolve the path and confirm it stays inside a base directory |
| `crypto/insecure-random` | warn | medium | `Math.random()` in a file that deals with tokens, secrets, OTPs, salts or sessions | `crypto.randomUUID()` / `crypto.getRandomValues()` |
| `crypto/weak-password-hash` | fail | high | `createHash('md5' \| 'sha1')` in a file that handles passwords | argon2, bcrypt or scrypt |
| `deserialize/unsafe` | warn | high | `unserialize`, `node-serialize`, `yaml.load()` without a safe schema | `JSON.parse`, or js-yaml v4 with its default schema |
| `debug/enabled` | warn | low | `debug: true` / `DEBUG = true` hardcoded | Drive debug flags from the environment |
| `mixed-content/http-url` | warn | low | Hardcoded `http://` URLs to non-local hosts | Use `https://` |

## Dependencies (`--only dependencies`)

Advisories come from [OSV.dev](https://osv.dev), which aggregates GitHub Security Advisories, PyPI, npm and NVD data. See [SECURITY.md](../SECURITY.md#data-sent-over-the-network) for exactly what is sent. Use `--offline` to skip the lookup.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `deps/vulnerable` | fail (high, critical) / warn (medium, low) | from the advisory | A package version in `package-lock.json` (v1–v3) or an exact `pkg==x.y.z` pin in `requirements*.txt` has known vulnerabilities. The fix names the lowest version that patches all of them |
| `deps/lockfile` | warn | medium | `package.json` without any committed lockfile |
| `deps/unpinned` | warn | medium | A dependency declared as `*`, `latest` or an empty string |
| `deps/remote-source` | warn | low | Dependencies installed from git, GitHub shorthand or a URL (bypasses registry integrity checks) |
| `deps/install-script` | warn | high | `preinstall` / `install` / `postinstall` scripts that run `curl`, `wget`, `bash -c`, `\| sh`, `node -e` or `powershell` |
| `deps/advisories` | warn | low | OSV.dev couldn't be reached, so advisories weren't checked |

Not yet covered: `pnpm-lock.yaml`, `yarn.lock` and `bun.lock` are detected but not audited. The report tells you to run your package manager's own audit.

## Authentication (`--only auth`)

Route handlers include Next.js `route.ts` and `pages/api`, SvelteKit `+server.ts`, Express/Hono/Fastify routers, and server actions (`'use server'`).

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `auth/unprotected-mutation` | warn | high (low if middleware does auth) | A handler that changes data (POST/PUT/PATCH/DELETE or a server action) and touches the database, with no recognizable auth call (`auth()`, `getServerSession`, `getUser`, `getClaims`, `getToken`, `currentUser`, `jwtVerify`, `req.user`, a 401 response, …). Webhook, auth, login and signup routes are excluded |
| `auth/middleware` | warn | low | A Next.js or SvelteKit app with no `middleware.ts` / `proxy.ts` / `hooks.server.ts`, or one that does no auth |
| `auth/secret-documented` | warn | low | An auth library is in use but `.env.example` has no `AUTH_SECRET` / `JWT_SECRET` / `NEXTAUTH_SECRET` / `SESSION_SECRET` |

## API & Validation (`--only api`)

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `api/input-validation` | warn | medium | A mutating route reads the request body (`request.json()`, `req.body`, `formData()`, …) with no schema validation (Zod, Valibot, Yup, Joi, AJV, TypeBox, ArkType, express-validator, …) |
| `api/rate-limit` | warn | medium | No rate limiting anywhere (`@upstash/ratelimit`, `express-rate-limit`, `rate-limiter-flexible`, Arcjet, …). Login, signup and AI endpoints are the usual targets |
| `api/error-leak` | warn | low | `err.message` or `err.stack` returned in a response body |

## Database (`--only database`)

Covers every data store the project uses. Each group only runs when that store is detected (a dependency, a config file, or migrations), and the category is skipped if none are found.

### SQL and Supabase

Reads every `.sql` file, with SQL comments stripped. Severity depends on whether clients can reach the database directly. A project counts as **Supabase** when it depends on `@supabase/supabase-js` / `@supabase/ssr` or has `.sql`/`.toml` files under `supabase/`. Apps that only connect from the server (Drizzle, Prisma, `pg`) are protected by their own API, so missing RLS there is informational.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `db/rls-enabled` | fail | critical | A `public` table with no `alter table … enable row level security` (Supabase projects; informational otherwise) |
| `db/permissive-policy` | fail | critical | An `update`, `delete` or `all` policy with `using (true)`: anyone can change every row |
| `db/update-with-check` | fail | high | An UPDATE policy without `WITH CHECK`, so users can move rows to another owner |
| `db/view-security-invoker` | fail | high | A view without `security_invoker = true`. Views run as their owner and bypass RLS |
| `db/anon-insert` | warn | medium | An INSERT policy for `anon` with `with check (true)`, which lets anonymous users insert rows with any `user_id` |
| `db/definer-search-path` | warn | medium | A `SECURITY DEFINER` function without `set search_path` |
| `db/storage-policies` | warn | medium | Supabase Storage used in code, but no policies on `storage.objects` |
| `db/no-migrations` | warn | medium | Supabase used, but no SQL in the repo to verify. Run `supabase db pull` |
| `db/auth-role-deprecated` | warn | low | `auth.role()` in policies; use `to authenticated` instead |
| `db/url-documented` | warn | low | `.env.example` doesn't document a database URL |

### Firebase

Detected from the `firebase` / `firebase-admin` dependency, `firebase.json`, or `*.rules` files.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `db/firebase-open-rules` | fail | critical | Firestore or Storage rules that let anyone write (`allow write: if true;`, or `allow write;` / `create` / `update` / `delete` with no condition), "test mode" rules (`request.time < timestamp.date(...)`) that leave the database open until they expire, and Realtime Database rules with `".read"` / `".write": true` |
| `db/firebase-public-read` | warn | medium | `allow read;` (or `get` / `list`) with no condition, or `if true`: fine for public data like listings, never for user data |
| `db/firebase-auth-only` | warn | medium | A `match /{document=**}` wildcard that only checks `request.auth != null`, so any signed-in user can read and write every document |
| `db/firebase-no-rules` | warn | medium | Firebase is used but no rules files are in the repo, so they can't be reviewed |

### MongoDB, Prisma, Convex, PocketBase, Appwrite

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `db/nosql-injection` | fail | high | MongoDB/Mongoose queries (`find`, `findOne`, `updateOne`, `deleteMany`, ...) called directly with `req.body` / `req.query` / `req.params`, or with `{ ...req.body }`. Operator injection (`{"$ne": null}`) bypasses filters and logins |
| `db/mongo-where` | warn | high | `$where`, which runs JavaScript inside the database |
| `db/prisma-hardcoded-url` | fail | high | `url = "..."` in `schema.prisma` instead of `env("DATABASE_URL")` |
| `db/client-per-request` | warn | medium | `new PrismaClient()` inside a route handler with no `globalThis` singleton: every serverless instance opens a pool and the database runs out of connections |
| `db/convex-public-mutation` | warn | medium | A Convex `mutation` or `action` that never calls `ctx.auth.getUserIdentity()`, so anyone can call it from the browser |
| `db/pocketbase-open-rule` | warn | high (create/update/delete), medium (list/view) | A PocketBase collection rule set to `""`, which means anyone, including logged-out users (`null` means admins only) |
| `db/appwrite-public-write` | warn | high | `Permission.write/update/delete/create(Role.any())` |

### Any database

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `db/driver-in-client` | fail | critical | A server database driver imported in browser code: `pg`, `mysql2`, `postgres`, `@neondatabase/serverless`, `@planetscale/database`, `@libsql/client`, `@prisma/client`, `mongoose`, `mongodb`, `redis`, `ioredis`, `firebase-admin`, `knex`, `kysely`, `sequelize`, `typeorm`, `better-sqlite3` and Drizzle's server drivers. Browser SDKs (`@supabase/supabase-js`, `firebase`, `convex`) are fine, and so are imports only used as types (`import { User } from '@prisma/client'`), which TypeScript erases |
| `db/ssl-disabled` | warn | medium | `sslmode=disable`, `ssl: false`, `tls=false` or `rejectUnauthorized: false` for a non-local database |

## Payments (`--only payments`)

Runs when a payment SDK is installed (Stripe, PayPal, Paystack, Flutterwave, Lemon Squeezy, Razorpay, Polar, Square, M-Pesa) or payment-named source files exist.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `payments/webhook-signature` | fail | critical | A payment webhook or callback handler with no signature verification (`constructEvent`, `createHmac` + `timingSafeEqual`, `verifySignature`, Svix, …) |
| `payments/client-amount` | fail | high | The charge amount (`amount`, `unit_amount`) taken from the request body |
| `payments/idempotency` | warn | medium | A webhook handler that doesn't de-duplicate events (event IDs, idempotency keys, `ON CONFLICT`, upsert) |
| `payments/no-webhook` | warn | medium | Payments are used but there's no webhook handler, so payment is confirmed only by the client redirect |

**M-Pesa Daraja:** callbacks aren't signed. The fix suggests a secret token in the `CallBackURL` path, Safaricom IP allowlisting, and confirming with the Transaction Status API before crediting.

## Web Security (`--only web`)

Headers are looked up in `next.config.*`, `vercel.json`, `netlify.toml`, `_headers`, `nginx.conf`, `.htaccess`, `web.config`, middleware or proxy files, SvelteKit hooks, framework configs, and root `server`/`app`/`index`/`main` entry files. Using `helmet` satisfies all header checks.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `cookies/missing-httponly` | fail | high | Server code sets a session/auth/token cookie without `httpOnly` |
| `headers/csp` | warn | medium | No `Content-Security-Policy` |
| `headers/clickjacking` | warn | low | No `X-Frame-Options` or CSP `frame-ancestors` |
| `headers/nosniff` | warn | low | No `X-Content-Type-Options: nosniff` |
| `headers/hsts` | warn | low | No `Strict-Transport-Security`. Vercel and Netlify add it on their own domains, not on custom ones |
| `headers/referrer-policy` | warn | low | No `Referrer-Policy` |
| `web/production-sourcemaps` | warn | low | `productionBrowserSourceMaps: true` or Vite `sourcemap: true` |

## AI / LLM (`--only ai`)

Runs only when an LLM SDK is a dependency (`openai`, `@anthropic-ai/sdk`, `ai`, `@ai-sdk/*`, LangChain, `@google/genai`, Groq, Mistral, Cohere, Ollama, LlamaIndex, Replicate, …).

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `ai/browser-key` | fail | critical | `dangerouslyAllowBrowser: true`, or an `OpenAI`/`Anthropic`/`Groq` client built in client code. The API key ships to every visitor |
| `ai/exec-output` | fail | critical | Model output passed to `eval`, `new Function` or `exec`. Prompt injection becomes remote code execution |
| `ai/prompt-injection` | warn | medium | User input interpolated into the **system** prompt |
| `ai/token-limit` | warn | low | An LLM call with no `max_tokens` / `maxOutputTokens` limit |

## GraphQL (`--only graphql`)

Runs only for GraphQL **servers** (Apollo Server, GraphQL Yoga, Mercurius, express-graphql, graphql-http, Nest, Pothos, type-graphql). Client-only usage is skipped.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `graphql/auth-context` | warn | high | The server's `context` doesn't resolve a user, token or session |
| `graphql/depth-limit` | warn | medium | No depth or complexity limit (graphql-armor, graphql-depth-limit, …) |
| `graphql/introspection` | warn | low | Introspection isn't disabled in production |

## Real-Time (`--only realtime`)

Covers WebSocket, socket.io, Supabase Realtime channels, Pusher, Ably and `EventSource`.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `realtime/server-auth` | warn | high | A WebSocket server that accepts connections without checking a token, session or cookie |
| `realtime/plaintext-ws` | warn | medium | A hardcoded `ws://` URL to a non-local host |
| `realtime/cleanup` | warn | low | A subscription opened in a React `useEffect` with no `unsubscribe` / `removeChannel` / `close` |

---

## UI & Content (`--only ui`)

Things that make an app look unfinished, break on phones, or shut out keyboard and low-vision users. Runs when the project has frontend files (`.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`, `index.html`). Everything here is a warning: none of it blocks a deploy unless you use `--fail-on medium` or `--fail-on low`. Each rule reports at most 5 locations, then a count.

| Rule ID | Status | Severity | Detects |
|---|---|---|---|
| `ui/viewport` | warn | high | `index.html` without `<meta name="viewport">`, so phones render the desktop layout zoomed out (Next.js adds it automatically) |
| `content/boilerplate` | warn | medium | Starter template text left in: "Create Next App", "Generated by create next app", "Get started by editing", "Edit src/App.tsx and save to reload", "Vite + React", "Learn React", ... |
| `content/placeholder-text` | warn | medium | Lorem ipsum, "Your Company", "Company Name", "Acme Inc", "John Doe" in components |
| `content/localhost-url` | warn | medium | Hardcoded `http://localhost` / `127.0.0.1` URLs in app code. Env fallbacks (`process.env.X ?? ...`), `*.config.*` files and `scripts/` are skipped |
| `a11y/img-alt` | warn | medium | `<img>` / `<Image>` without `alt` (tags spanning several lines are handled) |
| `a11y/focus-hidden` | warn | medium | `outline-none` with no `focus:` / `focus-visible:` ring, outline, border or shadow in the same class list |
| `ui/low-contrast` | warn | medium | A Tailwind text and background color on the same element with a WCAG contrast ratio below 3:1 (e.g. `text-gray-300 bg-white` is 1.5:1). Covers the gray, slate, zinc, neutral, stone and yellow scales plus white and black; prefixed classes (`dark:`, `hover:`, `md:`) are ignored |
| `content/dead-link` | warn | low | `<a href="#">`, `href=""` or `javascript:void(0)` |
| `content/debug-leftovers` | warn | low | `debugger;` statements anywhere, and `console.log` in client-side code |
| `content/page-title` | warn | low | No `<title>` / `metadata.title` |
| `content/meta-description` | warn | low | No meta description / `metadata.description` |
| `ui/favicon` | warn | low | No favicon (`public/favicon.*`, `app/icon.*`, `<link rel="icon">`) |
| `ui/og-image` | warn | low | No link-preview image (`og:image`, `openGraph` metadata, `opengraph-image.*`) |
| `ui/viewport-zoom` | warn | low | The viewport disables pinch-zoom (`user-scalable=no`, `maximum-scale=1`) |
| `ui/fixed-width` | warn | low | `w-[Npx]` / `min-w-[Npx]` of 640px or more with no breakpoint prefix: sideways scrolling on phones |
| `ui/font-sprawl` | warn | low | More than 3 font families across `next/font`, Google Fonts links and CSS `font-family` |
| `ui/color-sprawl` | warn | low | More than 25 distinct hardcoded hex colors in components (theme and token files excluded) |
| `ui/z-index-war` | warn | low | z-index values of 1000 or more (`z-[9999]`, `zIndex: 99999`) |

## Known limits

This is a fast pattern-based scanner. It is not a full data-flow analyzer, so:

- **It can miss things.** It doesn't follow values across files, and it can't know that a helper like `requireAdmin()` does auth unless the name matches a known pattern. A clean report is not a security audit.
- **It can be wrong.** When a finding doesn't apply, add `// preflight-ignore: <reason>` so the reason sits in code review. If a rule is wrong often, please [open an issue](https://github.com/anomalyco/agent-preflight/issues) with a minimal example.
