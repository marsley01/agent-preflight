# Contributing

Thanks for your interest in contributing to Agent Preflight!

## Project Structure

```
agent-preflight/
├── apps/landing/          # Browser-based SPA (Vite + Tailwind + vanilla TS)
│   └── src/
│       ├── main.ts        # Landing page UI
│       └── scanner.ts     # GitHub-based scanner (client-side)
├── packages/cli/          # CLI tool (Node.js + Commander.js)
│   └── src/
│       ├── index.ts       # CLI entry point
│       ├── scan.ts        # Scan orchestrator + shared types
│       ├── reporter.ts    # Terminal report renderer
│       └── checks/        # Scanner check modules
│           ├── security.ts
│           ├── auth.ts
│           ├── payments.ts
│           ├── database.ts
│           ├── api.ts
│           ├── web.ts
│           ├── graphql.ts
│           ├── realtime.ts
│           └── vulnerabilities.ts
└── README.md
```

## Development Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/anomalyco/agent-preflight.git
   cd agent-preflight
   ```

2. **Install dependencies**
   ```bash
   cd packages/cli
   npm install
   ```

3. **Build the CLI**
   ```bash
   npm run build
   ```

4. **Run a local scan**
   ```bash
   npm run dev -- scan /path/to/project
   ```

   Or use the compiled version:
   ```bash
   node dist/index.js scan /path/to/project
   ```

## Adding a New Check

1. Create a new file in `packages/cli/src/checks/` (e.g. `docker.ts`)
2. Export an async function with this signature:
   ```ts
   export async function runDockerChecks(dir: string): Promise<CheckResult[]>
   ```
3. Import `CheckResult` from `../scan`
4. Register the check in `packages/cli/src/scan.ts`:
   - Import your function
   - Add a `shouldRun('docker')` block
5. Re-export from `packages/cli/src/checks/index.ts`
6. Add the category to the `--only` option description in `src/index.ts`
7. If the check applies to the landing page, add equivalent logic to `apps/landing/src/scanner.ts`

## Coding Guidelines

- Use TypeScript — no `any` types
- All check functions receive the project directory path and return `Promise<CheckResult[]>`
- Each check result must have a `status`: `'pass'` | `'fail'` | `'warn'`
- Use clear, actionable failure messages that tell the developer exactly what to fix
- Include the `file` and `line` fields when pointing to a specific issue location
- Avoid dependencies beyond what's already in `package.json`
- Keep functions focused — one concern per check module

## Pull Request Process

1. Create a feature branch from `main`
2. Run `npm run build` to verify compilation
3. Open a PR with a clear title and description
4. Link any related issues

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
