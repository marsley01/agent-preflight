# Contributing

Thanks for your interest in contributing to Agent Preflight!

## Project Structure

```
agent-preflight/
├── apps/landing/            # Web UI (Vite + React): scans public GitHub repos in the browser
├── packages/cli/            # npm package @preflight-agent/cli
│   ├── src/
│   │   ├── index.ts         # CLI entry (commander)
│   │   ├── scan.ts          # Orchestrator + programmatic API (scan, summarize)
│   │   ├── context.ts       # Walks the project once; file access, grep, git helpers
│   │   ├── types.ts         # CheckResult, severities, pass/fail/warn/info helpers
│   │   ├── reporter.ts      # pretty / markdown / SARIF renderers
│   │   └── checks/          # One module per category, registered in checks/index.ts
│   └── test/                # node:test suite (runs against dist/)
├── packages/shared/         # Rule catalog + browser scan engine used by the web UI
├── packages/vuln-engine/    # FastAPI threat-intel service (Python)
└── supabase/schema.sql      # Optional persistence for the web UI
```

## Development Setup

```bash
git clone https://github.com/marsley01/agent-preflight.git
cd agent-preflight/packages/cli
npm ci
npm test                       # build + run the test suite
node dist/index.js scan ../..  # scan this repo (should score 100/100)
```

## Adding a New Check

1. Add detection to the relevant module in `packages/cli/src/checks/`, or create a new module and register it in `checks/index.ts` (`{ id, name, run }`).
2. Checks receive a pre-loaded `ProjectContext`. Never touch the filesystem directly:
   - `ctx.code` gives first-party source files (tests, fixtures and minified files are excluded).
   - `ctx.grep(files, /re/)` gives line matches. String and regex literal contents are blanked so docs and rule definitions don't match. Pass `{ literals: true }` when the pattern lives inside a string (URLs, keys, CORS origins).
   - `ctx.hasDependency(...)`, `ctx.depsFor(file)`, `ctx.find(/path/)`, `ctx.first(...)` and `ctx.gitTracked(...)` are also available.
3. Return results built with `pass`, `fail`, `warn` and `info` from `types.ts`:
   - Give every finding a stable `id` like `category/rule`. SARIF and suppression rely on it.
   - Pick the `severity` by impact: `critical` means data exposure or account takeover, and `low` means hygiene.
   - Include `file`/`line` whenever you can point at code, plus a one-sentence `fix`.
   - Return a single `info` result when the category doesn't apply (no payment SDK, no GraphQL server, ...), so unrelated stacks aren't penalized.
4. Add a test in `packages/cli/test/` with both a positive case and a false-positive case.
5. Document every new `fail`/`warn` rule ID in [`docs/rules.md`](docs/rules.md) and add a line to [`CHANGELOG.md`](CHANGELOG.md). `test/docs.test.mjs` fails if a rule ID is missing from the docs, or if the docs list one that no longer exists.
6. If the rule should also appear in the web UI, add it to `packages/shared/src/checks/index.ts` and `engine.ts`.

## Coding Guidelines

- TypeScript, ESM, no new runtime dependencies without a good reason (the CLI ships with 3).
- Prefer precision over recall: a noisy rule gets ignored, along with everything else in the report.
- Make messages say what is wrong *and* why it matters; put the fix in `fix`.
- Never print secret values: redact them in `snippet`.

## Pull Request Process

1. Create a feature branch from `main`
2. Run `npm test` in `packages/cli` (and `npm run build` in `apps/landing` if you touched the web UI)
3. Open a PR with a clear title and description
4. Link any related issues

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
