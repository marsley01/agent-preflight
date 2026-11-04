import type { ProjectContext, SourceFile } from '../context.js';
import { type CheckResult, fail, warn } from '../types.js';
import { detectStack, type Stack } from '../stack.js';
import { findRouteFiles } from './routes.js';
import { isEnvTemplate } from './security.js';

/** ORM / driver config files that hold the connection string. */
export const ORM_CONFIG = /(^|\/)(schema\.prisma|prisma\/schema\/[\w-]+\.prisma|drizzle\.config\.[cm]?[jt]s|knexfile\.[cm]?[jt]s|kysely\.config\.[cm]?[jt]s|ormconfig\.(json|[cm]?[jt]s)|data-source\.[cm]?[jt]s)$/;

const DB_URL = /\b(postgres(?:ql)?|mysql|mariadb):\/\/(?:([^:@/\s'"`]+)(?::([^@\s'"`]*))?@)?([^:/\s?'"`]+)/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|db|postgres|database|mysql)$/;
const PLACEHOLDER = /^(<[^>]*>|\[[^\]]*\]|\$\{[^}]*\}|password|pass|pwd|user|username|secret|changeme|your[-_]?\w*|x+|\*+|\.\.\.)$/i;
/** Owner / superuser roles: `postgres` (incl. Supabase pooler `postgres.<ref>`), Neon `*_owner`, root/admin. */
const OWNER_ROLE = /^(postgres(\.[a-z0-9]+)?|\w+_owner|root|admin|superuser|supabase_admin|rdsadmin|sa)$/i;

interface DbUrl {
  file: string;
  line: number;
  text: string;
  user?: string;
  password?: string;
  host: string;
}

function dbUrls(ctx: ProjectContext, files: SourceFile[]): DbUrl[] {
  return ctx.grep(files, DB_URL, { literals: true }).map((m) => ({
    file: m.file, line: m.line, text: m.text, user: m.match[2], password: m.match[3], host: m.match[4],
  }));
}

const realPassword = (u: DbUrl) => !!u.password && !PLACEHOLDER.test(u.password);

/** "Read it from an env var", phrased for the ORM that owns the config file. */
function envFix(file: string): string {
  if (/\.prisma$/.test(file)) return 'Use `url = env("DATABASE_URL")` and keep the value in .env.';
  if (/drizzle\.config/.test(file)) return 'Use `dbCredentials: { url: process.env.DATABASE_URL! }` and keep the value in .env.';
  if (/knexfile/.test(file)) return 'Use `connection: process.env.DATABASE_URL` and keep the value in .env.';
  return 'Read the connection string from process.env.DATABASE_URL and keep the value in .env.';
}

/** db/hardcoded-url: a literal connection string to a real (non-local) database in ORM config. */
function hardcodedUrl(ctx: ProjectContext): CheckResult[] {
  return dbUrls(ctx, ctx.find(ORM_CONFIG))
    .filter((u) => !LOCAL_HOST.test(u.host) && !/env\s*\(|process\.env|import\.meta\.env/.test(u.text))
    .map((u) => fail('db/hardcoded-url', 'high', `Database URL hardcoded in ${u.file.split('/').pop()}${realPassword(u) ? ', including its password' : ''}`, {
      file: u.file, line: u.line,
      snippet: realPassword(u) ? u.text.replace(u.password!, '********') : u.text,
      fix: envFix(u.file) + (realPassword(u) ? ' The password is in git history now, so rotate it.' : ''),
    }));
}

function leastPrivilegeFix(stack: Stack): string {
  const grant = 'grant select, insert, update, delete on all tables in schema public to app_user;';
  if (stack.provider === 'neon') return `Create an app role in the Neon Console (Roles), ${grant} and use it in DATABASE_URL. Keep the owner role for migrations only.`;
  if (stack.provider === 'supabase') return `Create a dedicated role (create role app_user login password '...'; ${grant}) for server-side connections. Keep postgres for migrations only.`;
  return `create role app_user login password '...'; ${grant} Use it in DATABASE_URL and keep the owner role for migrations only.`;
}

/** db/owner-role: env templates / ORM config connecting as the owner or superuser role. */
function ownerRole(ctx: ProjectContext, stack: Stack): CheckResult[] {
  const files = ctx.find(ORM_CONFIG).concat([...ctx.files.values()].filter((f) => isEnvTemplate(f.rel)));
  return dbUrls(ctx, files)
    .filter((u) => u.user && OWNER_ROLE.test(u.user) && !LOCAL_HOST.test(u.host))
    .map((u) => warn('db/owner-role', 'low', `App connects as the database owner role "${u.user}": a SQL injection or leaked URL gets full control of every table`, {
      file: u.file, line: u.line, fix: leastPrivilegeFix(stack),
    }));
}

/** Calls that open a connection pool, keyed by the import that makes them a pool. */
const POOL_CALLS: Array<{ re: RegExp; needs: RegExp; label: string }> = [
  { re: /new\s+PrismaClient\s*\(/, needs: /@prisma\/client/, label: 'new PrismaClient()' },
  { re: /new\s+(Pool|Client)\s*\(/, needs: /from\s+['"]pg['"]|require\(\s*['"]pg['"]\s*\)/, label: 'new Pool()' },
  { re: /(?<![\w.])postgres\s*\(/, needs: /from\s+['"]postgres['"]/, label: 'postgres()' },
  { re: /(?<![\w.])drizzle\s*\(\s*(process\.env|['"`]|\{)/, needs: /drizzle-orm\/(node-postgres|postgres-js|mysql2)/, label: 'drizzle(url)' },
  { re: /new\s+Kysely\s*[<(]/, needs: /from\s+['"]kysely['"]/, label: 'new Kysely()' },
  { re: /(?<![\w.])knex\s*\(\s*\{/, needs: /from\s+['"]knex['"]|require\(\s*['"]knex['"]\s*\)/, label: 'knex()' },
];

/**
 * db/pool-per-request: a pool created inside a request handler (indented code in a route file).
 * Neon's serverless driver is skipped: its docs recommend a per-request client on edge runtimes.
 */
function poolPerRequest(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  for (const f of findRouteFiles(ctx)) {
    if (/globalThis|global\.\w+\s*(\?\?|\|\|)?=|globalFor\w+/.test(f.content)) continue;
    for (const { re, needs, label } of POOL_CALLS) {
      if (!needs.test(f.content)) continue;
      const i = f.lines.findIndex((l) => /^\s+\S/.test(l) && re.test(l) && !/^\s*(\/\/|\*)/.test(l));
      if (i < 0 || ctx.isSuppressed(f, i + 1)) continue;
      results.push(warn('db/pool-per-request', 'medium', `${label} inside a request handler: every request opens new connections until the database runs out`, {
        file: f.rel, line: i + 1, snippet: f.lines[i].trim(),
        fix: 'Create the client once at module level (or in lib/db.ts, cached on globalThis in development) and import it.',
      }));
      break;
    }
  }
  return results;
}

const DESTRUCTIVE = /prisma\s+(db\s+push\b[^&|;\n]*--(accept-data-loss|force-reset)|migrate\s+reset\b)|drizzle-kit\s+(push\b[^&|;\n]*(--force\b|\s-f\b)|drop\b)|knex\s+migrate:rollback\b[^&|;\n]*--all|sequelize(-cli)?\s+db:drop|typeorm\s+schema:drop/;
const LIFECYCLE = /^(pre|post)?(build|install|start|deploy|release|prepare|vercel-build|heroku-postbuild)$/;
/** Deploy-time configs: anything destructive here runs against production. */
const DEPLOY_CONFIG = /(^|\/)(vercel\.json|netlify\.toml|Dockerfile[\w.-]*|Procfile|render\.ya?ml|fly\.toml|railway\.(json|toml)|nixpacks\.toml|app\.json)$/;
const CI_CONFIG = /(^|\/)(\.github\/workflows\/[\w.-]+\.ya?ml|\.gitlab-ci\.yml|bitbucket-pipelines\.yml|\.circleci\/config\.yml)$/;

/**
 * db/destructive-script: schema reset / force-push commands that run automatically on build, install,
 * start or deploy. CI workflows only count when they deploy; a test job resetting a throwaway database is fine.
 */
function destructiveScripts(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const fix = 'Run schema changes as a reviewed migration step (prisma migrate deploy / drizzle-kit migrate), never a reset or force-push on every deploy.';

  for (const f of ctx.find(/(^|\/)package\.json$/)) {
    let scripts: Record<string, string>;
    try {
      scripts = JSON.parse(f.content).scripts ?? {};
    } catch {
      continue;
    }
    for (const [name, cmd] of Object.entries(scripts)) {
      if (!LIFECYCLE.test(name) || typeof cmd !== 'string') continue;
      // Follow one level of `npm run x` / `pnpm x` / `yarn x` indirection.
      const called = [...cmd.matchAll(/(?:npm run|pnpm(?: run)?|yarn(?: run)?|bun run)\s+([\w:.-]+)/g)].map((m) => scripts[m[1]] ?? '');
      const hit = [cmd, ...called].map((c) => c.match(DESTRUCTIVE)?.[0]).find(Boolean);
      if (!hit) continue;
      const line = f.lines.findIndex((l) => l.includes(`"${name}"`)) + 1 || undefined;
      results.push(fail('db/destructive-script', 'high', `"${name}" script runs \`${hit.trim()}\`: every ${name.replace(/^(pre|post)/, '')} can drop data`, { file: f.rel, line, fix }));
    }
  }

  const ciFiles = ctx.find(CI_CONFIG).filter((f) => /deploy|release|production|\bprod\b/i.test(f.rel + f.content));
  for (const m of ctx.grep([...ctx.find(DEPLOY_CONFIG), ...ciFiles], DESTRUCTIVE, { literals: true })) {
    results.push(fail('db/destructive-script', 'high', `Deploy step runs \`${m.match[0].trim()}\`: every deploy can drop data`, { file: m.file, line: m.line, snippet: m.text, fix }));
  }
  return results;
}

/** Postgres / ORM rules that apply to any provider (Neon, Railway, RDS, Supabase, self-hosted). */
export function runPostgresChecks(ctx: ProjectContext): CheckResult[] {
  const stack = detectStack(ctx);
  return [...hardcodedUrl(ctx), ...ownerRole(ctx, stack), ...poolPerRequest(ctx), ...destructiveScripts(ctx)];
}
