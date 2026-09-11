import React, { useState } from 'react';

interface DocsViewProps {
  onShowToast: (msg: string) => void;
}

export const DocsView: React.FC<DocsViewProps> = ({ onShowToast }) => {
  const [pkgManager, setPkgManager] = useState<'npm' | 'pnpm' | 'yarn' | 'npx'>('npm');
  const [activeCiTab, setActiveCiTab] = useState<'github' | 'gitlab' | 'bitbucket'>('github');

  const installCmds = {
    npm: 'npm i -g agent-preflight',
    pnpm: 'pnpm add -g agent-preflight',
    yarn: 'yarn global add agent-preflight',
    npx: 'npx agent-preflight check'
  };

  const copyInstall = () => {
    navigator.clipboard.writeText(installCmds[pkgManager]);
    onShowToast(`Copied ${pkgManager} command to clipboard`);
  };

  const exampleCliOutput = [
    '$ preflight check',
    '',
    'Loading your project...',
    '✔ 84 checks passed',
    '✘ 12 issues found',
    '△ 6 warnings',
    '',
    'Production readiness: 76%',
    '',
    'Issues:',
    '  HIGH   security-secrets-client-exposure    src/config.ts:14',
    '  HIGH   runtime-error-boundary-missing      src/app/page.tsx:1',
    '  WARN   performance-image-unoptimized       src/components/Hero.tsx:5',
    '',
    'SARIF report written to ./preflight-report.sarif',
  ].join('\n');

  const githubYaml = `name: Preflight AST Check
on: [push, pull_request]

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run Preflight
        uses: agent-preflight/action@v1
        with:
          fail-on: high
          schema-path: supabase/migrations`;

  const gitlabYaml = `preflight_scan:
  image: node:20-alpine
  script:
    - npx agent-preflight check --fail-on high --sarif-output sarif.json
  artifacts:
    reports:
      codequality: sarif.json`;

  const bitbucketYaml = `pipelines:
  default:
    - step:
        name: Preflight Security Check
        script:
          - npx agent-preflight check --fail-on high`;

  const getCiSnippet = () => {
    if (activeCiTab === 'gitlab') return gitlabYaml;
    if (activeCiTab === 'bitbucket') return bitbucketYaml;
    return githubYaml;
  };

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto px-gutter-desktop py-space-xl gap-space-xl">
      {/* Header */}
      <div className="flex flex-col gap-space-xs max-w-3xl">
        <div className="flex items-center gap-space-sm font-label-md text-label-md text-secondary">
          <span className="font-label-sm text-label-sm text-primary uppercase tracking-wide">LEARN</span>
          <span>/</span>
          <span>Run Preflight your way</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          Run Preflight in your workflow
        </h1>
        <p className="font-body-lg text-body-lg text-secondary leading-relaxed">
          Use the same checks from your terminal or your CI pipeline — so a broken app never ships on your watch.
        </p>
      </div>

      {/* Package Manager Quick Install */}
      <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-surface-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Installation</h3>
            <p className="font-body-sm text-body-sm text-secondary">Install globally or run zero-install via npx in your terminal</p>
          </div>
          <div className="flex rounded bg-surface-container p-0.5">
            {(['npm', 'pnpm', 'yarn', 'npx'] as const).map((pm) => (
              <button
                key={pm}
                type="button"
                onClick={() => setPkgManager(pm)}
                className={`px-3 py-1 rounded font-label-md text-label-md transition-colors ${
                  pkgManager === pm ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface'
                }`}
              >
                {pm}
              </button>
            ))}
          </div>
        </div>

        <div className="p-space-md rounded bg-inverse-surface text-inverse-on-surface flex items-center justify-between font-code-inline text-code-inline shadow-sm">
          <div className="flex items-center gap-space-sm overflow-x-auto">
            <span className="text-inverse-on-surface/50 select-none">$</span>
            <span className="text-inverse-on-surface">{installCmds[pkgManager]}</span>
          </div>
          <button
            type="button"
            onClick={copyInstall}
            className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 text-inverse-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            <span>Copy</span>
          </button>
        </div>
      </div>

      {/* CLI Common Output Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <div className="lg:col-span-5 p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-surface-container">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">CLI Command Reference</h3>
          <p className="font-body-sm text-body-sm text-secondary">Flags supported by the published CLI:</p>
          <div className="flex flex-col gap-space-sm">
            <div className="p-space-sm rounded bg-surface-container-low font-label-md text-label-md text-on-surface">
              <span>preflight check</span>
              <span className="block font-body-sm text-body-sm text-secondary">Run all checks on this project; writes results to ./preflight-report.sarif</span>
            </div>
            <div className="p-space-sm rounded bg-surface-container-low font-label-md text-label-md text-on-surface">
              <span>preflight init</span>
              <span className="block font-body-sm text-body-sm text-secondary">Create a .preflightrc.json so you can tune which checks matter to you</span>
            </div>
            <div className="p-space-sm rounded bg-surface-container-low font-label-md text-label-md text-on-surface">
              <span>preflight check --fail-on high</span>
              <span className="block font-body-sm text-body-sm text-secondary">Fail (exit code 1) only if a high-severity issue is found</span>
            </div>
            <div className="p-space-sm rounded bg-surface-container-low font-label-md text-label-md text-on-surface">
              <span>preflight check --config .preflightrc.json</span>
              <span className="block font-body-sm text-body-sm text-secondary">Point to a specific config file instead of the default</span>
            </div>
          </div>
        </div>

        {/* Terminal Log Output */}
        <div className="lg:col-span-7 rounded-xl bg-inverse-surface text-inverse-on-surface flex flex-col overflow-hidden shadow-sm">
          <div className="bg-white/10 px-space-md py-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-space-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-outline"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container"></span>
              <span className="font-label-md text-label-md text-inverse-on-surface ml-2">Example CLI Output</span>
            </div>
            <span className="font-label-sm text-label-sm text-inverse-on-surface/60">Reference output — exact format may vary by version</span>
          </div>
          <pre className="p-space-lg font-code-inline text-code-inline text-inverse-on-surface overflow-x-auto leading-relaxed h-[260px]">
            <code>{exampleCliOutput}</code>
          </pre>
        </div>
      </div>

      {/* CI/CD Integration Workflow Snippets */}
      <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-surface-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Add Preflight to your CI pipeline</h3>
            <p className="font-body-sm text-body-sm text-secondary">Stop bad code from merging — Preflight blocks PRs that fail critical checks.</p>
          </div>
          <div className="flex rounded bg-surface-container p-0.5">
            {(['github', 'gitlab', 'bitbucket'] as const).map((ci) => (
              <button
                key={ci}
                type="button"
                onClick={() => setActiveCiTab(ci)}
                className={`px-3 py-1 rounded font-label-md text-label-md transition-colors ${
                  activeCiTab === ci ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface'
                }`}
              >
                {ci === 'github' ? 'GitHub Actions' : ci === 'gitlab' ? 'GitLab CI' : 'Bitbucket'}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-inverse-surface text-inverse-on-surface flex flex-col overflow-hidden">
          <div className="bg-white/10 px-space-md py-3 flex items-center justify-between border-b border-white/10">
            <span className="font-label-md text-label-md text-inverse-on-surface">
              {activeCiTab === 'github'
                ? '.github/workflows/preflight.yml'
                : activeCiTab === 'gitlab'
                ? '.gitlab-ci.yml'
                : 'bitbucket-pipelines.yml'}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(getCiSnippet());
                onShowToast(`Copied ${activeCiTab.toUpperCase()} workflow file`);
              }}
              className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 text-inverse-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              <span>Copy Workflow</span>
            </button>
          </div>
          <pre className="p-space-lg font-code-inline text-code-inline text-inverse-on-surface overflow-x-auto leading-relaxed">
            <code>{getCiSnippet()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
