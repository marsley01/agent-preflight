# Changelog

All notable changes to `@preflight-agent/cli` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). While the version is below 1.0, minor releases may include breaking changes, and they are called out below.

## 0.2.1 — Unreleased

Accuracy fixes from scanning real Next.js + Supabase / Stripe starters, plus database coverage for any Postgres backend and ORM. Rule details: [docs/rules.md](docs/rules.md).

### Changed (rule IDs)

0.2.0 was only published under the `next` tag, so these renames affect very few users. Update any `preflight-ignore` comments or SARIF filters that use the old IDs.

- `db/prisma-hardcoded-url` is now **`db/hardcoded-url`**, and also covers `drizzle.config.*`, `knexfile.*`, `kysely.config.*`, `ormconfig.*` and `data-source.*`.
- `db/client-per-request` is now **`db/pool-per-request`**, and also covers `pg`, `postgres()`, `drizzle(url)`, Kysely and Knex.
- **`db/update-with-check` changed meaning.** A policy *without* WITH CHECK is no longer flagged, because Postgres reuses USING. Only a WITH CHECK that is explicitly looser than USING is flagged (e.g. `with check (true)`).

### Added

- **Stack detection.** The report starts with `Detected: Next.js · Drizzle · Neon Postgres`, worked out from dependencies, config files and env templates. Fix hints use the detected platform: `auth.uid()` for Supabase, `auth.user_id()` and Drizzle's `crudPolicy` for Neon, a session-setting predicate for plain Postgres.
- **Postgres beyond Supabase.** Neon (including the Data API), Vercel Postgres, Railway, AWS RDS and self-hosted, with Drizzle, Prisma, Kysely, Knex, TypeORM, Sequelize, postgres.js and pg.
- **Tables from ORMs.** Drizzle `pgTable()` definitions and Prisma models are checked alongside SQL migrations. Drizzle RLS is recognised (`pgTable.withRLS`, `pgPolicy`, `crudPolicy`, `.link()`, `.enableRLS()`). Missing RLS is critical only when browsers can reach the database (Supabase, Neon Data API, PostgREST, Hasura); server-only apps get an informational note.
- **New rules:**
  - `db/destructive-script`: `prisma db push --accept-data-loss`, `prisma migrate reset`, `drizzle-kit push --force` and similar in build, install, start or deploy scripts, deploy configs, or deploying CI workflows.
  - `db/owner-role`: connecting as `postgres`, `neondb_owner` or another owner role.
  - `injection/sql-raw-variable`: Drizzle / Kysely `sql.raw()` with a variable.
- **Sleeker terminal output.**
  - Categories that don't apply collapse into one "Skipped" line.
  - Passing checks are summarised per category.
  - Identical findings in several files show once with every location.
  - `-v` shows everything. `--format json` and SARIF are unchanged apart from the new rules.
- **Database findings show `file:line`.** A statement repeated in `schema.sql` and a migration is reported once, listing every location (new `also` field; SARIF `relatedLocations`).

### Fixed (false positives)

- **Env templates:** `.env.local.example`, `.env.sample`, `*.env.template` and similar were reported as committed secrets. They are now treated like `.env.example`, and only flagged when they hold a real secret value.
- **Localhost fallbacks:** a localhost URL used as a fallback after an env var (`??`, `||`, a multi-line ternary, an `if (process.env...)` guard) is no longer flagged. CLIs run from `package.json` scripts are no longer flagged either.
- **Supabase SSR cookies:** `cookies.set(name, value, options)` passes through library-controlled options, so it is no longer reported as missing `httpOnly`.
- **Public analytics tokens:** `NEXT_PUBLIC_MIXPANEL_TOKEN` and similar map/analytics tokens are public by design and no longer flagged.
- **Provider objects in scripts:** a Stripe price object's `unit_amount` in a sync script is no longer treated as a client-supplied amount.
- **Supabase demo key:** the public `supabase start` demo service_role key is a medium warning, not a critical leak.

### Fixed (missed findings)

- `secrets/db-url-password` ignored real hosts whose name starts with `db.` (for example `db.prod.company.net`).

## 0.2.0

A rewrite of the scanner focused on accuracy and CI use. Rule-by-rule details: [docs/rules.md](docs/rules.md).

### Upgrading from 0.1.x

No changes are needed. Existing commands, flags and `--json` output keep working, and `packages/cli/test/cli-contract.test.mjs` guards this in CI. What you will notice:

- **More findings.** 0.2 detects far more real problems, and 0.1.x silently scanned nothing on Windows. If you use `--strict`, a pipeline that passed before may now fail, because it found something real. To gate only on serious issues, switch to `--fail-on high`.
- **`--json` keeps its shape.** It is still an array of `{ name, checks[{ status, message, file?, line? }] }`, and status is still only `pass`, `fail` or `warn`. Each check gains `id`, `severity`, `fix` and `snippet`. Three categories are new (`Dependencies`, `AI / LLM`, `UI & Content`); existing category names are unchanged in this format. The new full report object is `--format json`.
- **One network call.** The dependency check sends package names and versions (never code) to OSV.dev. Pass `--offline` to skip it. If OSV can't be reached, the scan continues with a warning and doesn't fail.
- **Only high and critical CVEs fail.** Lower-severity dependency advisories are warnings, so they don't trip `--strict`.
- **Terminal output changed.** It now shows severities, fixes, and a 0-100 score instead of passed/total. Some categories have new display names (Security is now Secrets, Vulnerabilities is now Code Vulnerabilities).
- **Scan errors exit with code 2** (a bad directory, for example), so they can be told apart from findings (`--strict` / `--fail-on` still exit 1).
- **The package is now ESM.** The `preflight` command is unchanged and runs on Node.js 18 or later. `main` now points to a programmatic API (`import { scan } from "@preflight-agent/cli"`) instead of the CLI entry.

### Added

- **Dependency vulnerabilities** via OSV.dev for `package-lock.json` and pinned `requirements.txt`, with the version to upgrade to. Also flags unpinned versions, git-sourced dependencies, install scripts that download code, and missing lockfiles. `--offline` skips the network lookup.
- **Secret detection by value:** AWS, GitHub, Stripe, OpenAI, Anthropic, Google, Slack, SendGrid, Resend, private keys, DB URLs with passwords, and Supabase `service_role` JWTs (decoded to confirm the role). Also detects `.env` files committed to git and secret env vars exposed through `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_`.
- **Code vulnerability rules** that report the file and line: SQL and command injection, `new Function`, `v-html`, disabled TLS verification, JWT `alg: none` / decode without verify / ignored expiry, CORS `*` with credentials, SSRF, open redirects, path traversal, insecure randomness, MD5/SHA-1 password hashing, unsafe deserialization.
- **Database rules:** RLS checked per table, tables with RLS but no policies, `using (true)` write policies, anonymous insert policies, `SECURITY DEFINER` without `search_path`, Storage policies.
- **Payments:** prices taken from the request body. Signature checks now also cover Paystack, Flutterwave, Lemon Squeezy and Svix-style webhooks, with M-Pesa-specific guidance.
- **More databases than Supabase:** Firebase (open and test-mode rules, auth-only wildcards, public reads), MongoDB (operator injection, `$where`), Prisma (hardcoded URLs, a client per request), Convex (mutations without auth), PocketBase and Appwrite (public write rules), plus any server database driver imported into browser code and connections with TLS turned off.
- **UI & Content category (`--only ui`):** catches what makes an app look unfinished or broken: starter template text, lorem ipsum, dead links, hardcoded localhost URLs, debug leftovers, images without alt text, removed focus outlines, unreadable Tailwind color pairs (real WCAG contrast math), fixed widths that overflow phones, missing viewport, title, description, favicon or link preview, font and color sprawl, z-index hacks. Everything is a warning, so it never blocks `--strict`.
- **AI / LLM category:** SDK keys in the browser, user input in system prompts, missing token limits, model output passed to `eval`/`exec`.
- **Output formats:** `--format markdown` for PR comments and job summaries, `--format sarif` for GitHub Code Scanning, and `-o/--output <file>`.
- **CI gating with `--fail-on <severity>`.** Exit codes are now `0` ok, `1` gate failed, `2` scan error.
- **Suppression:** `preflight-ignore` comments and a `.preflightignore` file.
- **Fixes in the report:** every finding carries a one-line `fix`, and `-v` shows code snippets (secrets redacted).
- A **programmatic API**: `import { scan } from '@preflight-agent/cli'`.
- `preflight categories` lists category IDs.

### Fixed

- **Windows:** most checks silently scanned nothing, because glob patterns were built from backslash paths.
- **Node 20:** the CLI could crash with `ERR_REQUIRE_ESM` (CommonJS build loading ESM-only `chalk`/`ora`).
- **Supabase checks never ran.** The module existed but wasn't registered.
- **`.env` gitignore check:** it passed when `.gitignore` only listed `.env.example`. It now asks git directly.
- **False positives:**
  - server code reading `process.env.*_SECRET_KEY`, and patterns inside strings, comments, docs and tests
  - every `src/` file in a monorepo treated as browser code
  - RLS required for apps that don't expose the database to clients
- **Score fairness:** stacks a category doesn't apply to (no GraphQL, no payments, …) are no longer penalized.

### Security

- **Scanning a repository can no longer execute code from its `.git/config`.** Git's `core.fsmonitor` and hooks are disabled for the scanner's git calls.
- **Smaller dependency tree.** Removed `glob` (vulnerable `brace-expansion`) and the unused `dotenv`. There are now 3 runtime dependencies and `npm audit` reports 0 vulnerabilities.
- **Smaller npm package.** It now contains only `dist/` and the README.

## 0.1.2 and earlier

The first releases: a terminal checklist covering security, auth, payments, database, API, web, GraphQL, real-time and basic vulnerability patterns, plus `--json`, `--strict` and `--only`.

