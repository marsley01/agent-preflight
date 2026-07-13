# @preflight-agent/cli

A fast, interactive pre-deploy security scanner. Run security checks locally before pushing to GitHub.

## Installation

```bash
# Run without installing
npx @preflight-agent/cli scan [dir]

# Or install globally
npm install -g @preflight-agent/cli
preflight scan [dir]
```

## Usage

```bash
# Scan current directory
preflight scan

# Scan a specific project
preflight scan ./path/to/project

# Output JSON instead of terminal report
preflight scan --json

# Exit with code 1 if any checks fail (for CI)
preflight scan --strict

# Run only one category
preflight scan --only security
preflight scan --only auth
preflight scan --only database
```

## Options

| Flag | Description |
|------|-------------|
| `scan [dir]` | Scan a project directory (defaults to current dir) |
| `--json` | Output results as JSON |
| `--strict` | Exit with code 1 if any checks fail |
| `--only <category>` | Run only one category |

## Categories

| Category | `--only` value | Checks |
|----------|---------------|--------|
| Security | `security` | Hardcoded API keys, `.env` gitignored, Supabase service role exposure |
| Authentication | `auth` | Auth middleware, JWT/NextAuth secrets, unprotected API routes |
| Payments | `payments` | Webhook signature validation (Stripe, M-Pesa), try/catch, idempotency keys |
| Database | `database` | Row-Level Security (RLS) policies, database URL in `.env.example` |
| API & Validation | `api` | Input validation (Zod/Yup), rate limiting |
| Web Security | `web` | Content-Security-Policy, clickjacking, CORS, secure cookie flags |
| GraphQL | `graphql` | Query depth limiting, auth context, introspection disabled |
| Real-Time | `realtime` | WebSocket cleanup, reconnection logic, channel auth |
| Vulnerabilities | `vulnerabilities` | XSS, `eval()`, HSTS, mixed content, CSRF, debug mode, MIME sniffing, build artifacts in `.gitignore` |

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
  ✅  Error handling (try/catch) found in payment routes

  Database
  ✅  Row-Level Security (RLS) enabled in migrations
  ✅  Database URL documented in .env.example

Score: 6/10 — Fix 2 critical issues before deploying.
```

## JSON Output

Use `--json` to pipe results into other tools:

```bash
preflight scan --json | jq '.'
```

## CI Integration

Use `--strict` to fail the build when issues are found:

```bash
preflight scan --strict
```

Combine with GitHub Actions — see [.github/workflows/preflight-scan.yml](../../.github/workflows/preflight-scan.yml).

## License

MIT
