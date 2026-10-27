# 🛫 agent-preflight

**Pre-deploy checklist CLI for vibe coders.**  
Catch the bugs AI agents introduce before they hit production.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/@preflight-agent/cli)](https://npmjs.com/package/@preflight-agent/cli)
[![CI](https://github.com/marsley01/agent-preflight/actions/workflows/ci.yml/badge.svg)](https://github.com/marsley01/agent-preflight/actions/workflows/ci.yml)
[![Snyk](https://img.shields.io/badge/security-Snyk-brightgreen)](https://github.com/marsley01/agent-preflight/actions/workflows/snyk-security.yml)

---

## What it does

You build fast with Cursor, Claude, or Copilot. AI agents are great at writing
code — but they consistently miss the same things:

- Exposing API keys and service role secrets in client-side code
- Skipping webhook signature validation on payment endpoints
- Forgetting Supabase RLS policies that leave data open
- Missing auth guards on protected routes
- Accepting unvalidated input on API routes

`agent-preflight scan` catches all of this before you deploy.

---

## Quick Start

```bash
npx @preflight-agent/cli scan
```

Run it from any project root. It scans your code and outputs a scored report.

---

## Example Output

```
🛫 Agent Preflight v0.2.0 — Pre-Deploy Scan
Scanning: /Users/you/my-app

  Secrets
  ❌  HIGH     NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY uses a public prefix — it will be shipped to every browser (.env.example:2)
  ✅  .env is gitignored

  Code Vulnerabilities
  ❌  CRITICAL SQL built with string interpolation — SQL injection (lib/db.ts:2)
        ↳ Use parameterized queries ($1 placeholders) or a tagged template (sql`...`) that escapes values.

  Database & RLS
  ❌  CRITICAL Table profiles has no RLS — readable and writable by anyone with the anon key (supabase/migrations/001_init.sql)

  Payments
  ❌  CRITICAL Payment webhook does not verify signatures — anyone can POST a fake "payment succeeded" event (app/api/stripe/webhook/route.ts)
  …

Score: 0/100 — 2/11 checks passed · 4 critical, 3 high, 1 medium, 1 low
Fix 7 critical/high issues before deploying.
```

## Install

```bash
# Run without installing
npx @preflight-agent/cli scan

# Or install globally
npm install -g @preflight-agent/cli
preflight scan
```

## Options

| Flag | Description |
|------|-------------|
| `scan [dir]` | Scan a project directory (defaults to current dir) |
| `--format <f>` | `pretty`, `json`, `markdown` (PR comments) or `sarif` (GitHub Code Scanning) |
| `--fail-on <severity>` | Exit 1 on any finding at or above `critical`/`high`/`medium`/`low` |
| `--strict` | Exit 1 if any check fails |
| `--only security,database` | Run only specific categories |
| `--offline` | Skip the OSV.dev dependency vulnerability lookup |
| `-o, --output <file>` | Write the report to a file |

Suppress a single finding with a `preflight-ignore` comment, or exclude paths with a `.preflightignore` file. Full reference: [packages/cli/README.md](packages/cli/README.md).

## Checks

| Category | What it checks |
|----------|----------------|
| Secrets | Real key formats (AWS, GitHub, Stripe, OpenAI, Anthropic, Google, Slack, private keys, Supabase `service_role` JWTs), committed `.env` files, secrets behind `NEXT_PUBLIC_`/`VITE_` prefixes |
| Code Vulnerabilities | SQL and command injection, `eval`, XSS, disabled TLS verification, JWT misuse, CORS `*` with credentials, SSRF, open redirects, path traversal, weak randomness and password hashing |
| Dependencies | Known CVEs via OSV.dev (npm lockfiles and `requirements.txt`) with fixed versions, unpinned and git-sourced deps, suspicious install scripts |
| Auth | Middleware, mutating routes without an auth check, auth secret documented |
| API | Unvalidated request bodies, rate limiting, error details leaked to clients |
| Database | Supabase/Postgres RLS and policies, Firebase open or test-mode rules, MongoDB injection, Prisma hardcoded URLs, Convex/PocketBase/Appwrite public writes, database drivers shipped to the browser, TLS turned off |
| Payments | Webhook signature verification (Stripe, M-Pesa Daraja, Paystack, ...), idempotency, client-supplied prices |
| Web | CSP, clickjacking, nosniff, HSTS, Referrer-Policy, production source maps, `httpOnly` session cookies |
| AI / LLM | SDK keys in the browser, user input in system prompts, missing token limits, model output executed |
| GraphQL | Depth limiting, introspection, auth context |
| Real-Time | Subscription cleanup, unauthenticated WebSocket servers, plaintext `ws://` |
| UI & Content | Leftover starter text and lorem ipsum, dead links, localhost URLs, missing alt text, invisible focus, low-contrast text, layouts that break on phones, missing title/favicon/link preview, font and color sprawl |

## GitHub Actions

```yaml
name: Preflight
on: [pull_request]
permissions:
  contents: read
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
      - run: npx -y @preflight-agent/cli scan --fail-on high
```

Findings show up inline on the PR via Code Scanning. See [preflight-scan.yml](.github/workflows/preflight-scan.yml) for the version this repo uses, which also posts a PR comment.

## Web UI

Scan public GitHub repos in the browser, without installing anything: paste a repo URL and get a report with ready-to-paste fixes. The scan runs entirely client-side via the GitHub API, with no backend. Run it locally with `npm run dev`, or see [apps/landing](apps/landing/README.md) for deploying your own.

## Built for vibe coders

Works with any Next.js, SvelteKit, Remix, or Express project.
Understands Supabase, Stripe, M-Pesa Daraja, and Resend patterns.

---

## Documentation

| | |
|---|---|
| [CLI reference](packages/cli/README.md) | Every option, output formats, suppression, CI recipes, programmatic API |
| [Rule reference](docs/rules.md) | Every rule ID: what it detects, severity and fix |
| [Web UI](apps/landing/README.md) | How browser scans work, GitHub tokens, deploying and the CSP |
| [vuln-engine](packages/vuln-engine/README.md) | Self-hosted threat-intel API: setup, env vars, endpoints |
| [Changelog](CHANGELOG.md) | What changed, including breaking changes |
| [Security policy](SECURITY.md) | Reporting vulnerabilities, and exactly what data leaves your machine |
| [Contributing](CONTRIBUTING.md) | Dev setup, architecture, adding a rule |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT © Anomaly Co.
