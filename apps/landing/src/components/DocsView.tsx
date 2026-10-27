import React, { useState } from 'react';
import { Icon } from './Icon';

interface DocsViewProps {
  onShowToast: (msg: string) => void;
}

const PKG = '@preflight-agent/cli';

const INSTALL = {
  npx: `npx ${PKG} scan`,
  npm: `npm i -g ${PKG}`,
  pnpm: `pnpm add -g ${PKG}`,
  yarn: `yarn global add ${PKG}`,
} as const;

const COMMANDS: Array<[string, string]> = [
  ['preflight scan', 'Run every check on the current project'],
  ['preflight scan --fail-on high', 'Exit with code 1 if anything high or critical is found'],
  ['preflight scan --only security,database', 'Run only some categories'],
  ['preflight scan --format sarif -o preflight.sarif', 'Write SARIF for GitHub Code Scanning (also json, markdown)'],
  ['preflight scan --offline', 'Skip the dependency CVE lookup'],
];

const EXAMPLE_OUTPUT = `$ preflight scan

  Secrets
  ❌  HIGH     NEXT_PUBLIC_STRIPE_SECRET_KEY uses a public prefix (src/config.ts:14)
  ✅  .env is gitignored

  Database & RLS
  ❌  CRITICAL Table profiles has no RLS (supabase/migrations/001_init.sql)

  Payments
  ❌  CRITICAL Payment webhook does not verify signatures (app/api/stripe/webhook/route.ts)

Score: 40/100, 18/24 checks passed · 2 critical, 1 high
Fix 3 critical/high issues before deploying.`;

const CI = {
  github: {
    label: 'GitHub Actions',
    file: '.github/workflows/preflight.yml',
    code: `name: Preflight
on: [push, pull_request]
permissions:
  contents: read
  security-events: write

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx -y ${PKG} scan --format sarif -o preflight.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: preflight.sarif
      - run: npx -y ${PKG} scan --fail-on high`,
  },
  gitlab: {
    label: 'GitLab CI',
    file: '.gitlab-ci.yml',
    code: `preflight_scan:
  image: node:22-alpine
  script:
    - npx -y ${PKG} scan --format markdown -o preflight.md
    - npx -y ${PKG} scan --fail-on high
  artifacts:
    when: always
    paths:
      - preflight.md`,
  },
  bitbucket: {
    label: 'Bitbucket',
    file: 'bitbucket-pipelines.yml',
    code: `pipelines:
  default:
    - step:
        name: Preflight
        image: node:22
        script:
          - npx -y ${PKG} scan --fail-on high`,
  },
} as const;

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-surface-container-low p-0.5">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`rounded-md px-2.5 py-1 font-label-md transition-colors ${value === id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function CodeBlock({ title, code, onCopy, maxH }: { title?: string; code: string; onCopy: () => void; maxH?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-inverse-surface text-inverse-on-surface">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-code-inline opacity-70">{title ?? 'terminal'}</span>
        <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-label-sm opacity-80 transition hover:bg-white/10 hover:opacity-100">
          <Icon name="copy" size={13} /> Copy
        </button>
      </div>
      <pre className={`overflow-x-auto p-4 font-code-inline leading-relaxed ${maxH ? 'max-h-80' : ''}`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const DocsView: React.FC<DocsViewProps> = ({ onShowToast }) => {
  const [pm, setPm] = useState<keyof typeof INSTALL>('npx');
  const [ci, setCi] = useState<keyof typeof CI>('github');

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    onShowToast(`${what} copied`);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-4 py-8 sm:px-6 md:py-12">
      <div>
        <h1 className="font-headline-lg text-on-surface">CLI &amp; CI</h1>
        <p className="mt-2 max-w-[65ch] font-body-lg text-on-surface-variant">
          Run the same checks on your machine and block risky pull requests. The CLI sees more than the web scan: git history, lockfiles and dependency CVEs.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline-md text-on-surface">Install</h2>
          <Segmented label="Package manager" value={pm} onChange={setPm} options={Object.keys(INSTALL).map((k) => [k as keyof typeof INSTALL, k])} />
        </div>
        <CodeBlock code={`$ ${INSTALL[pm]}`} onCopy={() => copy(INSTALL[pm], 'Install command')} />
        <p className="font-body-sm text-on-surface-variant">Requires Node.js 18 or later. Your code never leaves your machine; only package names and versions are sent to OSV.dev for the CVE check.</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-3">
          <h2 className="font-headline-md text-on-surface">Common commands</h2>
          <ul className="overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest">
            {COMMANDS.map(([cmd, desc]) => (
              <li key={cmd} className="border-b border-surface-container-high px-4 py-3 last:border-0">
                <code className="font-code-inline text-on-surface">{cmd}</code>
                <p className="mt-0.5 font-body-sm text-on-surface-variant">{desc}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-headline-md text-on-surface">Example output</h2>
          <CodeBlock code={EXAMPLE_OUTPUT} onCopy={() => copy(EXAMPLE_OUTPUT, 'Output')} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-headline-md text-on-surface">Add it to CI</h2>
            <p className="mt-1 font-body-sm text-on-surface-variant">Fails the pipeline on high or critical findings, and shows them inline on GitHub pull requests.</p>
          </div>
          <Segmented label="CI provider" value={ci} onChange={setCi} options={(Object.keys(CI) as Array<keyof typeof CI>).map((k) => [k, CI[k].label])} />
        </div>
        <CodeBlock title={CI[ci].file} code={CI[ci].code} onCopy={() => copy(CI[ci].code, `${CI[ci].label} workflow`)} maxH />
      </section>

      <section id="github-token" className="flex flex-col gap-3 rounded-xl border border-surface-container-high bg-surface-container-lowest p-5">
        <h2 className="flex items-center gap-2 font-headline-sm text-on-surface">
          <Icon name="shield" size={17} /> Higher limits for web scans
        </h2>
        <p className="max-w-[70ch] font-body-sm text-on-surface-variant">
          Anonymous web scans share GitHub's limit of 60 requests an hour per IP. Each scan uses about two, so you rarely hit it. To scan private repos or raise the limit,
          create a{' '}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="text-on-surface underline underline-offset-2">
            fine-grained, read-only token
          </a>{' '}
          and save it in this browser from the devtools console:
        </p>
        <CodeBlock code={`localStorage.setItem('github_token', 'github_pat_...')`} onCopy={() => copy(`localStorage.setItem('github_token', 'github_pat_...')`, 'Snippet')} />
        <p className="font-body-sm text-secondary">The token stays in your browser and is only sent to api.github.com. Reload the page after saving it.</p>
      </section>
    </div>
  );
};
