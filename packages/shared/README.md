# @preflight-agent/shared

The browser scan engine and rule catalog behind the [web UI](../../apps/landing). It's a private package that isn't published to npm, and it's consumed as TypeScript source through the `@shared/*` path alias in `apps/landing`.

| File | Contents |
|---|---|
| `src/types.ts` | `CheckDefinition`, `CheckResult`, `ScanReport`, categories, scan stages |
| `src/checks/index.ts` | The rule catalog: each `CheckDefinition` has its risk, weight, "why it matters", example exploit and suggested fix. `ALL_CHECKS`, `CHECKS_BY_CATEGORY`, `getCheckById()` |
| `src/engine.ts` | `scanGitHubRepo(input, signal?, onProgress?, token?)`: loads a GitHub repo over HTTP and runs all category checks against it |
| `src/scoring.ts` | Weighted category scores, the overall production score, and readiness labels |

## Usage

```ts
import { scanGitHubRepo } from '@shared/engine';
import { getReadinessLabel } from '@shared/scoring';

const controller = new AbortController();
const report = await scanGitHubRepo('github.com/vercel/next.js', controller.signal, (p) => console.log(p.stage));

if (report.status === 'complete') {
  console.log(report.score.percentage, getReadinessLabel(report.score.percentage).label);
}
```

`scanGitHubRepo` never throws for expected failures (bad URL, repo not found, rate limit, abort). It returns a report with `status: 'error'` or `'cancelled'` and an `error` message instead.

## Adding a rule

1. Add a `CheckDefinition` to the right array in `src/checks/index.ts`. Its `id` must be unique, and its `weight` and `risk` feed the score.
2. Emit results with that `checkId` from the matching runner in `src/engine.ts`. Every `checkId` the engine emits must exist in the catalog, or it falls back to weight 5 and shows no metadata in the UI.
3. Use `ctx.codeFiles` / `ctx.codeJoined` for code patterns, so docs, tests and build output can't trigger or satisfy a check, and `findInCode()` to report a file and line.
4. Run `npm run build` in `apps/landing`, which typechecks this package.
