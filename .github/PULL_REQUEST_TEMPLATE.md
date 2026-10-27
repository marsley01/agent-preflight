## What and why

<!-- What does this change, and what problem does it solve? Link issues with "Fixes #123". -->

## Type

- [ ] New rule / detection
- [ ] False-positive or false-negative fix
- [ ] Bug fix
- [ ] Web UI
- [ ] Docs / CI / chore

## Checklist

- [ ] `npm test` passes in `packages/cli`
- [ ] `npm run build` passes in `apps/landing` (if the web UI or `packages/shared` changed)
- [ ] New or changed rules have a test with both a positive and a false-positive case
- [ ] New rule IDs are documented in [`docs/rules.md`](../docs/rules.md) (the docs test enforces this)
- [ ] User-facing changes are noted in [`CHANGELOG.md`](../CHANGELOG.md)
- [ ] No real secrets in fixtures. Build test keys at runtime (e.g. `'AKIA' + '...'`) or mark them with `preflight-ignore`
