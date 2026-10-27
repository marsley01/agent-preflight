# Security Policy

Agent Preflight is a security tool, so we hold it to a higher bar. Thank you for helping keep it and its users safe.

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Report privately through GitHub: go to **[Security → Report a vulnerability](https://github.com/marsley01/agent-preflight/security/advisories/new)**. Please include:

- the affected component (CLI, web UI, vuln-engine or the Supabase schema) and version or commit
- steps to reproduce, or a proof of concept
- the impact you see, such as secret disclosure, code execution or bypassing a check

What to expect:

| | |
|---|---|
| Acknowledgement | within 3 business days |
| Initial assessment | within 7 days |
| Fix or mitigation | critical issues within 14 days where possible |

We'll keep you updated, credit you in the release notes if you'd like, and coordinate disclosure with you.

### In scope

- The CLI leaking scanned secrets: printing unredacted credentials, or sending source code anywhere
- Code execution or path traversal triggered by scanning a malicious repository (scanned code is only *read*, never executed)
- The web UI leaking a user's GitHub token to anyone other than GitHub
- Auth or CORS bypasses in `packages/vuln-engine`
- Policy flaws in `supabase/schema.sql`

### Out of scope

- **False negatives**, meaning a vulnerable pattern the scanner doesn't detect. These are welcome as regular [issues](https://github.com/marsley01/agent-preflight/issues). See [Known limits](docs/rules.md#known-limits).
- Findings in projects you scanned. Report those to that project.
- Missing headers on preview deployments, or anything that needs a compromised machine

## Supported versions

| Version | Supported |
|---|---|
| 0.2.x | ✅ |
| < 0.2 | ❌ Please upgrade. 0.1.x missed most secrets and silently skipped checks on Windows |

## Data sent over the network

The CLI reads your code locally and never uploads it. There is no telemetry.

| Component | Talks to | What is sent | How to turn it off |
|---|---|---|---|
| CLI: dependency check | `api.osv.dev` | Package **names and versions** from `package-lock.json` / `requirements*.txt` (e.g. `lodash@4.17.20`), plus advisory IDs to fetch details | `--offline`, or `--only` without `dependencies` |
| CLI: everything else | nothing | Runs `git ls-files` and `git check-ignore` locally to detect committed `.env` files | — |
| Web UI | `api.github.com`, `raw.githubusercontent.com` (straight from your browser) | The repository you asked to scan. If you set a token, it goes only to `api.github.com` | — |
| Web UI | your browser's `localStorage` | Your GitHub token (if you set one) and scan history. Nothing is sent to an Agent Preflight server, because there isn't one | Clear site data |
| vuln-engine (self-hosted) | NVD, GitHub GraphQL, PyPI, npm registry, OpenAI | Feed queries. `POST /v1/fix` sends the submitted error log and code to OpenAI | Don't set `OPENAI_API_KEY` |

### GitHub tokens in the web UI

Use a **fine-grained token with read-only access to public repositories**. It only raises the rate limit. The token never goes into the site's build: it's read from your browser's `localStorage` at runtime, so each visitor uses their own.

## Hardening in this repository

- The CLI has 3 runtime dependencies. CI runs `npm audit`, `pip-audit`, Snyk (when configured) and the scanner on itself, with `--fail-on high`.
- The deployed web UI sends a strict CSP plus HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` (see `vercel.json`).
- `vuln-engine` only accepts POST requests from localhost unless `PREFLIGHT_API_KEY` is set. CORS is an explicit allowlist.
- Dependabot watches the npm, pip and GitHub Actions dependencies.
