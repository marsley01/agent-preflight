# Web UI (`apps/landing`)

The browser version of Agent Preflight, live at **[agent-preflight-mashs-projects-01ac6ca6.vercel.app](https://agent-preflight-mashs-projects-01ac6ca6.vercel.app)** and deployed on Vercel from this repo. Paste a public GitHub repo and get a production-readiness report across security, AI safety, runtime, infrastructure, observability, performance, accessibility and compliance.

The scan runs **entirely in your browser**. Files are fetched straight from GitHub, and there is no Agent Preflight backend.

Built with Vite, React 19, React Router, Zustand, Tailwind CSS 4, Phosphor icons and self-hosted Geist fonts. Recharts is loaded only on the Progress tab.

Light and dark mode follow the OS by default; the header toggle pins one (saved in `localStorage` as `preflight-theme` and applied before first paint by `public/theme-init.js`). All colors are CSS variables in `src/style.css`, so components never hardcode a theme.

## Develop

```bash
cd apps/landing
npm ci
npm run dev        # http://localhost:5173
npm run build      # typecheck (including packages/shared) + production build to dist/
npm run preview    # serve the production build locally
```

From the repo root, `npm run dev` and `npm run build` do the same.

## How a scan works

The engine lives in [`packages/shared`](../../packages/shared) and is imported through the `@shared/*` alias (see `vite.config.ts` and `tsconfig.json`).

1. **Repo metadata and file tree:** 2 calls to `api.github.com` (the repo, then the recursive Git Trees API).
2. **File contents:** up to 1,500 relevant files of 500 KB or less, fetched 25 at a time.
   - Without a token, files come from `raw.githubusercontent.com`, which doesn't count against GitHub's 60-requests-per-hour API limit.
   - With a token, files come from the contents API, which also works for private repos.
   - Lockfiles, `node_modules` and binaries are not downloaded.
3. **Checks:** every category runs in parallel against the fetched files. Results are scored with weights from the rule catalog in `packages/shared/src/checks/index.ts`.
4. **History:** the last 30 scans are stored in `localStorage` under `preflight-scan-history`, which powers the "since your last scan" comparison.

### GitHub token (optional)

Anonymous scans are limited to 60 GitHub API calls an hour. Each scan uses about 2, so this rarely matters. For private repos, or to raise the limit, set a token in the browser console:

```js
localStorage.setItem('github_token', 'github_pat_...')
```

Use a **fine-grained, read-only** token. It stays in your browser and is only sent to `api.github.com`.

> Never put a token in a `VITE_*` environment variable. Vite inlines those into the public JavaScript bundle, so every visitor would get it.

## Project layout

```
src/
├── main.tsx, App.tsx       # Router: / (dashboard) and /docs
├── pages/DashboardPage.tsx # Main app shell
├── components/             # Overview, rules catalog, docs, charts, search, toasts
├── store/
│   ├── scan-store.ts       # Runs scans, progress, history (Zustand)
│   └── rules-store.ts      # Rules catalog filters
└── lib/                    # Finding helpers, rules data adapter
```

## Deploy

Deployed on Vercel from the repo root using [`vercel.json`](../../vercel.json):

- install with `npm ci`, build with `npm run build`, output `apps/landing/dist`
- an SPA rewrite so `/docs` and other client routes load `index.html`
- security headers on every response: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`
- immutable caching for hashed files under `/assets/`

**If you add a third-party script, font, image host or API call, update the CSP in `vercel.json`**, or the browser will block it in production even though it works in `npm run dev`. The current policy only allows this site plus `api.github.com` and `raw.githubusercontent.com`: fonts (Geist) and icons (Phosphor) are bundled, not loaded from a CDN.

## Relationship to the CLI

The web UI and the CLI (`packages/cli`) have separate rule sets. The web UI covers broader production-readiness categories. The CLI is deeper on security and can see everything on disk, including git state and lockfiles for CVE lookups. For a real pre-deploy gate, use the CLI in CI.
