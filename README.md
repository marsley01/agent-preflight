# 🛫 agent-preflight

**Pre-deploy checklist CLI for vibe coders.**  
Catch the bugs AI agents introduce before they hit production.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/@preflight-agent/cli)](https://npmjs.com/package/@preflight-agent/cli)
[![CI](https://github.com/anomalyco/agent-preflight/actions/workflows/preflight-scan.yml/badge.svg)](https://github.com/anomalyco/agent-preflight/actions/workflows/preflight-scan.yml)
[![Snyk](https://img.shields.io/badge/security-Snyk-brightgreen)](https://github.com/anomalyco/agent-preflight/actions/workflows/snyk-security.yml)

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
🛫 Agent Preflight — Pre-Deploy Scan
Scanning: /Users/you/my-project

  Security
  ✅  .env is gitignored
  ✅  No hardcoded API keys found in source
  ❌  Supabase service role key found in client-side code (src/lib/supabase.ts:12)

  Authentication
  ✅  Auth middleware found on protected routes
  ⚠️  JWT secret not set in .env.example

  Payments
  ❌  No webhook signature validation found in src/app/api/webhook/route.ts
  ✅  Payment error handling present

  API & Validation
  ⚠️  3 API routes missing input validation (Zod or Yup not detected)
  ✅  Rate limiting detected (Upstash Redis)

  Database
  ✅  RLS mention found in migrations
  ✅  .env.example includes DATABASE_URL

Score: 6/10 — Fix 2 critical issues before deploying.
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
| `--json` | Output results as JSON |
| `--strict` | Exit with code 1 if any checks fail |
| `--only security` | Run only a specific category |

## Checks

| Category | What it checks |
|----------|----------------|
| Security | Hardcoded API keys in client code, `.env` gitignored, service role exposure |
| Auth | Auth middleware presence, JWT/NextAuth secret in `.env.example`, unprotected routes |
| Payments | Webhook signature validation, error handling, idempotency keys |
| Database | Row-Level Security (RLS) in migrations, database URL in `.env.example` |
| API | Input validation (Zod/Yup), rate limiting, unvalidated POST routes |
| Web | CSP headers, clickjacking protection, CORS config, secure cookie flags |
| GraphQL | Query depth limiting, auth context, introspection disabled in production |
| Real-Time | Connection cleanup, reconnection logic, auth on WebSocket channels |
| Vulnerabilities | XSS (`dangerouslySetInnerHTML`), `eval()`, MIME sniffing, HSTS, mixed content, CSRF, debug mode leaks, build artifacts in `.gitignore` |

## GitHub Actions

Add the following to `.github/workflows/preflight-scan.yml` to automatically scan every PR:

```yaml
name: Preflight Scan
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: preflight-agent/cli@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Results are posted as a PR comment. See [preflight-scan.yml](.github/workflows/preflight-scan.yml) for the full workflow.

## Web UI

Scan public GitHub repos without installing anything:

👉 **[preflight-agent.vercel.app](https://preflight-agent.vercel.app)**

Paste a GitHub repo URL, get an instant scan report in your browser. The scan runs entirely client-side via the GitHub API — no backend involved.

## Built for vibe coders

Works with any Next.js, SvelteKit, Remix, or Express project.
Understands Supabase, Stripe, M-Pesa Daraja, and Resend patterns.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT © Anomaly Co.
