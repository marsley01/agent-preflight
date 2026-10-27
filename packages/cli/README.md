# @preflight-agent/cli

A fast pre-deploy security scanner for apps built with AI coding agents. It catches the mistakes Cursor, Claude and Copilot keep making (leaked keys, missing RLS, unsigned webhooks, SQL injection, vulnerable dependencies) before they reach production.

- **Zero config.** Run it in any project root.
- **Points at the line.** Every code finding has a file, line, snippet and a concrete fix.
- **CI-ready.** Exit codes by severity, Markdown for PR comments, SARIF for GitHub Code Scanning.
- **Live CVE data.** Dependencies are checked against [OSV.dev](https://osv.dev) (npm and PyPI).

## Installation

```bash
# Run without installing
npx @preflight-agent/cli scan

# Or install globally
npm install -g @preflight-agent/cli
preflight scan
```

Requires Node.js 18 or later.

**Upgrading from 0.1.x?** Nothing to change: `scan`, `--json`, `--strict` and `--only` behave as before. Expect more findings, since 0.2 catches far more real problems (and actually scans on Windows). See the [changelog](https://github.com/anomalyco/agent-preflight/blob/main/CHANGELOG.md).

## Usage

```bash
preflight scan                       # scan the current directory
preflight scan ./path/to/project     # scan another directory
preflight scan --only security,database
preflight scan --fail-on high        # CI gate: exit 1 on any high/critical finding
preflight scan --format sarif -o preflight.sarif
preflight scan --format markdown > report.md
preflight scan --offline             # skip the OSV.dev dependency lookup
preflight categories                 # list category ids
```

## Options

| Flag | Description |
|------|-------------|
| `scan [dir]` | Scan a project directory (defaults to the current directory) |
| `-f, --format <format>` | `pretty` (default), `json` (full report object), `markdown`, or `sarif` |
| `--json` | JSON array of categories (the 0.1.x format, kept for existing scripts) |
| `-o, --output <file>` | Write the report to a file instead of stdout |
| `--fail-on <severity>` | Exit 1 if any finding is `critical`, `high`, `medium` or `low` or worse |
| `--strict` | Exit 1 if any check fails |
| `--only <ids>` | Comma-separated categories to run |
| `--offline` | Skip network lookups (dependency advisories) |
| `-v, --verbose` | Show the offending code snippet for each finding |

Exit codes: `0` ok, `1` findings exceeded `--fail-on` / `--strict`, `2` the scan itself failed.

## Categories

| Category | `--only` id | What it checks |
|----------|-------------|----------------|
| Secrets | `security` | Real key formats (AWS, GitHub, Stripe, OpenAI, Anthropic, Google, Slack, SendGrid, Resend, private keys, DB URLs with passwords, Supabase `service_role` JWTs), committed `.env` files (via git), `.env` gitignored, secret env vars behind `NEXT_PUBLIC_` / `VITE_` / `EXPO_PUBLIC_` prefixes, service role used in client code |
| Code Vulnerabilities | `vulnerabilities` | SQL injection (template and concatenation), command injection, `eval` / `new Function`, XSS (`dangerouslySetInnerHTML`, `innerHTML`, `v-html`), TLS verification disabled, JWT `alg: none` / decode without verify, CORS `*` with credentials, SSRF, open redirects, path traversal, insecure randomness for tokens, MD5/SHA-1 passwords, unsafe deserialization |
| Dependencies | `dependencies` | Known CVEs in `package-lock.json` and pinned `requirements.txt` (OSV.dev, with fixed versions), missing lockfile, `*` / `latest` versions, git/URL dependencies, install scripts that download code |
| Authentication | `auth` | Auth middleware (Next.js `middleware`/`proxy`, SvelteKit hooks), mutating routes that touch data without an auth check, auth secret documented |
| API & Validation | `api` | Request bodies used without a schema (Zod, Valibot, Yup, Joi, ...), rate limiting, raw errors returned to clients |
| Database | `database` | **Supabase/Postgres:** RLS per table, `using (true)` write policies, UPDATE without `WITH CHECK`, anonymous inserts, views without `security_invoker`, `SECURITY DEFINER` without `search_path`, Storage policies. **Firebase:** open and test-mode rules, auth-only wildcards. **MongoDB:** operator injection, `$where`. **Prisma:** hardcoded URLs, a client per request. **Convex, PocketBase, Appwrite:** unauthenticated mutations and public write rules. **Any database:** server drivers imported in browser code, TLS turned off |
| Payments | `payments` | Webhook signature verification (Stripe, M-Pesa Daraja, Paystack, Flutterwave, Lemon Squeezy, ...), idempotency, prices taken from the request body |
| Web Security | `web` | CSP, clickjacking, nosniff, HSTS, Referrer-Policy (or helmet), production source maps, session cookies without `httpOnly` |
| AI / LLM | `ai` | LLM SDK used from the browser, user input in system prompts, missing output token limits, model output passed to `eval`/`exec` |
| GraphQL | `graphql` | Depth/complexity limits, introspection in production, auth context (servers only) |
| Real-Time | `realtime` | Subscription cleanup in React effects, unauthenticated WebSocket servers, plaintext `ws://` |
| UI & Content | `ui` | Starter template text and lorem ipsum left in, dead `href="#"` links, hardcoded `localhost` URLs, debug leftovers, images without `alt`, invisible keyboard focus, unreadable text/background contrast, fixed widths that break phones, missing viewport / title / description / favicon / link preview, too many fonts or one-off colors, z-index hacks |

Categories that don't apply to your stack (for example, Payments with no payment provider) are reported as skipped and don't affect the score.

Full rule list with severities and fixes: **[docs/rules.md](https://github.com/anomalyco/agent-preflight/blob/main/docs/rules.md)**.

## Example output

```
🛫 Agent Preflight v0.2.0 — Pre-Deploy Scan
Scanning: /Users/you/my-app

  Secrets
  ❌  HIGH     NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY uses a public prefix — it will be shipped to every browser (.env.example:2)
        ↳ Drop the public prefix and only read this variable in server code (API routes, server actions, edge functions).
  ✅  .env is gitignored

  Code Vulnerabilities
  ❌  CRITICAL SQL built with string interpolation — SQL injection (lib/db.ts:2)
        ↳ Use parameterized queries ($1 placeholders) or a tagged template (sql`...`, Prisma.$queryRaw``) that escapes values.

  Database & RLS
  ❌  CRITICAL Table profiles has no RLS — readable and writable by anyone with the anon key (supabase/migrations/001_init.sql)
        ↳ alter table profiles enable row level security;  -- then add policies

  Payments
  ❌  CRITICAL Payment webhook does not verify signatures — anyone can POST a fake "payment succeeded" event (app/api/stripe/webhook/route.ts)
        ↳ Use stripe.webhooks.constructEvent(rawBody, sig, secret) (or your provider's verify helper) on the raw request body.
  …

Score: 0/100 — 2/11 checks passed · 4 critical, 3 high, 1 medium, 1 low
Fix 7 critical/high issues before deploying.
```

The score starts at 100 and loses points once per distinct rule at its worst severity (critical −25, high −10, medium −4, low −1; warnings count half).

## Suppressing findings

- **One line:** put a `preflight-ignore` comment on the line or the line above it.
  ```ts
  // preflight-ignore: test fixture, not a real key
  const key = 'AKIA...';
  ```
- **Whole paths:** list gitignore-style globs in `.preflightignore` at the project root.
  ```
  scripts/seed/
  **/*.generated.ts
  ```

`node_modules`, build output (`dist`, `.next`, ...), tests, fixtures and minified files are skipped automatically for code checks.

## CI

### GitHub Actions: PR comment, Code Scanning and a gate

```yaml
name: Preflight
on: [pull_request]
permissions:
  contents: read
  pull-requests: write
  security-events: write
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx -y @preflight-agent/cli scan --format sarif -o preflight.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: preflight.sarif, category: agent-preflight }
      - run: npx -y @preflight-agent/cli scan --format markdown >> "$GITHUB_STEP_SUMMARY"
      - run: npx -y @preflight-agent/cli scan --fail-on high
```

See [preflight-scan.yml](https://github.com/anomalyco/agent-preflight/blob/main/.github/workflows/preflight-scan.yml) for a version that also posts a PR comment.

## Programmatic API

```ts
import { scan, findingsAtOrAbove } from '@preflight-agent/cli';

const report = await scan('./my-app', { offline: true });
console.log(report.summary.score);
for (const f of findingsAtOrAbove(report, 'high')) console.log(f.id, f.file, f.line, f.message);
```

## JSON output

There are two JSON formats.

**`--json`** prints the format 0.1.x used, so existing scripts keep working: an array of `{ name, checks[] }`, where each check has `status` (`pass` / `fail` / `warn`), `message` and optionally `file` and `line`. Since 0.2, each check also carries `id`, `severity`, `fix` and `snippet`.

```bash
preflight scan --json | jq '[.[].checks[] | select(.status == "fail")] | length'
```

**`--format json`** prints the full report: `{ tool, root, durationMs, summary, categories[] }`. `summary` holds the score and counts by severity, and checks can have status `info` (not applicable). Use this for new integrations.

## Privacy

Your code never leaves your machine. The only network call is the dependency check, which sends package **names and versions** to OSV.dev; `--offline` turns it off. Details: [SECURITY.md](https://github.com/anomalyco/agent-preflight/blob/main/SECURITY.md#data-sent-over-the-network).

## License

MIT
