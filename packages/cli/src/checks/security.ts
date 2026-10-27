import type { ProjectContext, SourceFile } from '../context.js';
import { type CheckResult, type Severity, pass, fail, warn } from '../types.js';

/**
 * High-signal patterns for real credential *values*. Matching on env var names
 * (e.g. `STRIPE_SECRET_KEY`) flags every server file that reads `process.env`,
 * so we only look for things that are actually keys.
 */
const SECRET_PATTERNS: { id: string; label: string; re: RegExp; severity: Severity }[] = [
  { id: 'aws-access-key', label: 'AWS access key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, severity: 'critical' },
  { id: 'github-token', label: 'GitHub token', re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/, severity: 'critical' },
  { id: 'stripe-live-key', label: 'Stripe live secret key', re: /\b[sr]k_live_[0-9a-zA-Z]{20,}\b/, severity: 'critical' },
  { id: 'stripe-test-key', label: 'Stripe test secret key', re: /\bsk_test_[0-9a-zA-Z]{20,}\b/, severity: 'medium' },
  { id: 'anthropic-key', label: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/, severity: 'critical' },
  { id: 'openai-key', label: 'OpenAI API key', re: /\bsk-(?!ant-)(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/, severity: 'critical' },
  { id: 'google-api-key', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/, severity: 'high' },
  { id: 'slack-token', label: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/, severity: 'high' },
  { id: 'sendgrid-key', label: 'SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/, severity: 'high' },
  { id: 'resend-key', label: 'Resend API key', re: /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}\b/, severity: 'high' },
  { id: 'private-key', label: 'Private key', re: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/, severity: 'critical' },
  { id: 'db-url-password', label: 'Database URL with password', re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^:\s/'"`]+:[^@\s'"`]{6,}@(?!localhost|127\.0\.0\.1|db\b|postgres\b)/, severity: 'high' },
];

/** JWTs whose payload declares `"role":"service_role"` (Supabase admin key). */
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/;

/** Env var names with a public prefix — these get inlined into the browser bundle. */
const PUBLIC_SECRET_NAME = /(?<![A-Za-z0-9])(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_|NUXT_PUBLIC_|GATSBY_)[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|_TOKEN\b|ADMIN_KEY)[A-Z0-9_]*/;

const PLACEHOLDER = /x{4,}|your[_-]|example|placeholder|changeme|<[^>]+>|\.\.\.|dummy|fake|redacted|\*{3,}/i;

/** Env files that are meant to be committed as documentation. */
const ENV_TEMPLATE = /\.env\.(example|sample|template|defaults|dist)$/;

function redact(text: string, secret: string): string {
  return text.replace(secret, `${secret.slice(0, 6)}${'*'.repeat(8)}`);
}

function decodeJwtRole(segment: string): string | undefined {
  try {
    const json = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    return JSON.parse(json)?.role;
  } catch {
    return undefined;
  }
}

function scanSecrets(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  // Real local .env files hold real secrets by design; whether they're *committed* is checked separately.
  const candidates: SourceFile[] = [...ctx.files.values()].filter((f) => {
    const name = f.rel.split('/').pop()!;
    if (name.startsWith('.env') && !ENV_TEMPLATE.test(name)) return false;
    if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(f.rel)) return false;
    return true;
  });

  for (const { id, label, re, severity } of SECRET_PATTERNS) {
    for (const m of ctx.grep(candidates, re, { literals: true })) {
      if (PLACEHOLDER.test(m.match[0])) continue;
      results.push(fail(`secrets/${id}`, severity, `${label} hardcoded in source`, {
        file: m.file,
        line: m.line,
        snippet: redact(m.text, m.match[0]),
        fix: 'Revoke and rotate this credential now, move it to an environment variable, and purge it from git history (git filter-repo / BFG).',
      }));
    }
  }

  for (const m of ctx.grep(candidates, JWT, { literals: true })) {
    if (decodeJwtRole(m.match[1]) !== 'service_role') continue;
    results.push(fail('secrets/supabase-service-role-jwt', 'critical', 'Supabase service_role key hardcoded — bypasses all RLS', {
      file: m.file,
      line: m.line,
      snippet: redact(m.text, m.match[0]),
      fix: 'Rotate the service_role key in the Supabase dashboard and only read it from a server-side env var.',
    }));
  }

  return results;
}

function checkPublicSecretNames(ctx: ProjectContext): CheckResult[] {
  // In code, only count actual env reads; in .env files, only count assignments.
  const inCode = ctx.grep(ctx.code, PUBLIC_SECRET_NAME, { literals: true }).filter((m) => /\benv\b/.test(m.text));
  const inEnv = ctx.grep(ctx.find(/(^|\/)\.env[^/]*$/), new RegExp(`^\\s*(export\\s+)?${PUBLIC_SECRET_NAME.source}\\s*=`));
  return [...inCode, ...inEnv].map((m) =>
    fail('secrets/public-env-secret', 'high', `${m.match[0].replace(/^\s*(export\s+)?|\s*=$/g, '')} uses a public prefix — it will be shipped to every browser`, {
      file: m.file,
      line: m.line,
      snippet: m.text,
      fix: 'Drop the public prefix and only read this variable in server code (API routes, server actions, edge functions).',
    }));
}

function checkServiceRoleInClient(ctx: ProjectContext): CheckResult[] {
  const client = ctx.code.filter((f) => isClientFile(ctx, f));
  return ctx.grep(client, /\benv\b.*SERVICE_ROLE|SERVICE_ROLE\w*\s*[,)]|serviceRoleKey/, { literals: true }).map((m) =>
    fail('secrets/service-role-client', 'critical', 'Supabase service role key referenced in client-side code', {
      file: m.file,
      line: m.line,
      snippet: m.text,
      fix: 'Use the anon key in the browser and keep service_role usage in server-only modules (add `import "server-only"`).',
    }));
}

/** Heuristic for code that ends up in the browser bundle. */
export function isClientFile(ctx: ProjectContext, f: SourceFile): boolean {
  if (/^\s*['"]use client['"]/m.test(f.content.slice(0, 500))) return true;
  if (/^\s*['"]use server['"]|import\s+['"]server-only['"]/m.test(f.content.slice(0, 1000))) return false;
  if (/(^|\/)(api|server|functions|supabase\/functions|scripts|migrations)\//.test(f.rel)) return false;
  if (/\.server\.[jt]sx?$/.test(f.rel)) return false;
  if (/(^|\/)(components|hooks|client)\//.test(f.rel)) return true;
  // Pure SPA (Vite/CRA) — everything under src is shipped to the browser.
  const deps = ctx.depsFor(f.rel);
  const isSpa = ['vite', 'react-scripts'].some((d) => deps.has(d))
    && !['next', '@remix-run/node', 'express', '@sveltejs/kit', 'nuxt', 'astro'].some((d) => deps.has(d));
  return isSpa && /(^|\/)src\//.test(f.rel);
}

/**
 * Check for security issues:
 * - Hardcoded credentials (real key formats, not variable names)
 * - Secret env vars exposed via public prefixes
 * - .env committed to git / not gitignored
 */
export function runSecurityChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];

  // --- .env hygiene ---
  const trackedEnv = (ctx.gitTracked('.env', '.env.*', '*/.env', '*/.env.*') ?? [])
    .filter((f) => !ENV_TEMPLATE.test(f));
  if (trackedEnv.length > 0) {
    for (const f of trackedEnv) {
      results.push(fail('secrets/env-committed', 'critical', `${f} is committed to git — every secret in it is leaked`, {
        file: f,
        fix: `Run \`git rm --cached ${f}\`, add it to .gitignore, and rotate every secret it contained.`,
      }));
    }
  }

  const gitignored = ctx.gitIgnores('.env');
  const gitignore = ctx.read('.gitignore');
  const ignoredByFile = gitignore?.split(/\r?\n/).some((l) => /^\/?(\.env|\.env\*|\*\.env|\.env\.?\*?|\*)$/.test(l.trim()));
  if (gitignored === true || (gitignored === null && ignoredByFile)) {
    results.push(pass('secrets/env-gitignored', '.env is gitignored'));
  } else if (gitignore === undefined && gitignored === null) {
    results.push(warn('secrets/env-gitignored', 'medium', 'No .gitignore found', { fix: 'Add a .gitignore containing `.env*` and `!.env.example`.' }));
  } else {
    results.push(fail('secrets/env-gitignored', 'high', '.env is NOT gitignored — your secrets will be committed', {
      file: '.gitignore',
      fix: 'Add `.env*` and `!.env.example` to .gitignore.',
    }));
  }

  if (ctx.allPaths.some((p) => ENV_TEMPLATE.test(p))) {
    results.push(pass('secrets/env-example', '.env.example exists'));
  } else {
    results.push(warn('secrets/env-example', 'low', 'No .env.example — collaborators won\'t know what vars to set'));
  }

  // --- leaked credentials ---
  const leaks = [...scanSecrets(ctx), ...checkPublicSecretNames(ctx), ...checkServiceRoleInClient(ctx)];
  results.push(...leaks);
  if (leaks.length === 0) {
    results.push(pass('secrets/hardcoded', 'No hardcoded credentials or client-exposed secrets found'));
  }

  return results;
}
