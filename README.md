# 🛫 agent-preflight

**Pre-deploy checklist CLI for vibe coders.**  
Catch the bugs AI agents introduce before they hit production.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/@agent-preflight/cli)](https://npmjs.com/package/@agent-preflight/cli)

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
npx @agent-preflight/cli scan
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
npx @agent-preflight/cli scan

# Or install globally
npm install -g @agent-preflight/cli
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
| Security | Keys in source, .env gitignored, service role exposure |
| Auth | Protected route middleware, session validation |
| Payments | Webhook signature, error handling, idempotency |
| Database | RLS policies, migration safety |
| API | Input validation, rate limiting, CORS |

## Built for vibe coders

Works with any Next.js, SvelteKit, Remix, or Express project.
Understands Supabase, Stripe, M-Pesa Daraja, and Resend patterns.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT © Anomaly Co.
