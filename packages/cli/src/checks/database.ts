import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, fail, warn, info } from '../types.js';
import { runDataStoreChecks } from './datastores.js';

const CREATE_TABLE = /create\s+table\s+(if\s+not\s+exists\s+)?((?:"?\w+"?\.)?"?(\w+)"?)/gi;

/** Strip `--` and `/* *\/` comments so commented-out SQL doesn't count. */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

/**
 * Check SQL migrations (Supabase / Postgres) for data exposure:
 * - Every created table has RLS enabled (per table, not just "somewhere")
 * - Tables with RLS have at least one policy
 * - Permissive `using (true)` policies on writes
 * - UPDATE policies have WITH CHECK
 * - Views without security_invoker, SECURITY DEFINER functions without search_path
 * - Deprecated auth.role()
 */
function runSqlChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const sqlFiles = ctx.sql;
  // RLS only matters when clients can reach the database directly (Supabase / PostgREST).
  // Apps that only connect from the server (Drizzle, Prisma, pg) are protected by their API layer.
  const usesSupabase = ctx.hasDependency('@supabase/supabase-js', '@supabase/ssr', '@supabase/auth-helpers-nextjs')
    || ctx.allPaths.some((p) => /(^|\/)supabase\/.+\.(sql|toml)$/.test(p));

  if (sqlFiles.length === 0) {
    return usesSupabase
      ? [warn('db/no-migrations', 'medium', 'Supabase used but no SQL migrations in the repo, so RLS cannot be verified', {
        fix: 'Run `supabase db pull` so your schema and policies are version-controlled and reviewable.',
      })]
      : [];
  }

  const sql = sqlFiles.map((f) => stripSqlComments(f.content)).join('\n');
  const fileFor = (re: RegExp) => sqlFiles.find((f) => re.test(f.content))?.rel;

  // --- RLS per table ---
  const tables = new Map<string, string>();
  for (const m of sql.matchAll(CREATE_TABLE)) {
    const full = m[2].replace(/"/g, '');
    const schema = full.includes('.') ? full.split('.')[0] : 'public';
    if (schema === 'public') tables.set(m[3].toLowerCase(), full);
  }

  const missingRls: string[] = [];
  const missingPolicy: string[] = [];
  for (const [name, full] of tables) {
    const t = `(?:"?public"?\\.)?"?${name}"?`;
    const rlsOn = new RegExp(`alter\\s+table\\s+(if\\s+exists\\s+)?(only\\s+)?${t}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql);
    if (!rlsOn) missingRls.push(full);
    else if (!new RegExp(`create\\s+policy[\\s\\S]*?\\bon\\s+${t}\\b`, 'i').test(sql)) missingPolicy.push(full);
  }

  if (tables.size > 0 && missingRls.length === 0) {
    results.push(pass('db/rls-enabled', `RLS enabled on all ${tables.size} public tables`));
  }
  if (!usesSupabase && missingRls.length > 0) {
    results.push(info('db/rls-enabled', `${missingRls.length} table(s) without RLS — fine while only your server connects to the database; enable it before exposing the DB to clients`));
    missingRls.length = 0;
  }
  for (const t of missingRls) {
    results.push(fail('db/rls-enabled', 'critical', `Table ${t} has no RLS — readable and writable by anyone with the anon key`, {
      file: fileFor(new RegExp(`create\\s+table[^;]*\\b${t.split('.').pop()}\\b`, 'i')),
      fix: `alter table ${t} enable row level security;  -- then add policies`,
    }));
  }
  for (const t of missingPolicy) {
    results.push(info('db/rls-no-policy', `Table ${t} has RLS but no policies — all access denied (fine if only the service role uses it)`));
  }

  // --- Overly permissive policies ---
  const policies = [...sql.matchAll(/create\s+policy\s+("[^"]+"|\w+)[\s\S]*?;/gi)].map((m) => m[0]);
  for (const p of policies) {
    const name = p.match(/create\s+policy\s+("[^"]+"|\w+)/i)?.[1];
    const isWrite = /for\s+(all|update|delete)\b/i.test(p);
    if (isWrite && /using\s*\(\s*true\s*\)/i.test(p)) {
      results.push(fail('db/permissive-policy', 'critical', `Policy ${name} allows any user to modify or delete every row (using (true))`, {
        file: fileFor(new RegExp(name!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
        fix: 'Scope the policy to the owner, e.g. `using ((select auth.uid()) = user_id)`.',
      }));
    }
    if (/for\s+update\b/i.test(p) && !/with\s+check/i.test(p)) {
      results.push(fail('db/update-with-check', 'high', `UPDATE policy ${name} has no WITH CHECK — users can reassign rows to other owners`, {
        fix: 'Add `with check ((select auth.uid()) = user_id)` matching the USING clause.',
      }));
    }
    if (/for\s+insert\b/i.test(p) && /to\s+[^;]*\banon\b/i.test(p) && /with\s+check\s*\(\s*true\s*\)/i.test(p)) {
      results.push(warn('db/anon-insert', 'medium', `Policy ${name} lets anonymous users insert arbitrary rows (including any user_id)`, {
        fix: 'Constrain it, e.g. `with check (user_id is null or user_id = (select auth.uid()))`, and add rate limiting.',
      }));
    }
  }

  // --- Views, functions, deprecated helpers ---
  const views = [...sql.matchAll(/create\s+(or\s+replace\s+)?view\s+([\w."]+)([^;]*)/gi)];
  for (const v of views) {
    if (!/security_invoker\s*=\s*(true|on)/i.test(v[3])) {
      results.push(fail('db/view-security-invoker', 'high', `View ${v[2]} runs as its owner and bypasses RLS`, {
        fix: `create view ${v[2]} with (security_invoker = true) as ...`,
      }));
    }
  }

  const fnStarts = [...sql.matchAll(/create\s+(or\s+replace\s+)?function\s+([\w."]+)/gi)];
  for (const [i, fn] of fnStarts.entries()) {
    const body = sql.slice(fn.index, fnStarts[i + 1]?.index ?? sql.length);
    if (!/security\s+definer/i.test(body) || /set\s+search_path/i.test(body)) continue;
    results.push(warn('db/definer-search-path', 'medium', `SECURITY DEFINER function ${fn[2]} without a fixed search_path — privilege escalation risk`, {
      fix: "Add `set search_path = ''` and fully qualify objects inside the function.",
    }));
  }

  if (/auth\.role\s*\(/.test(sql)) {
    results.push(warn('db/auth-role-deprecated', 'low', 'auth.role() in policies is deprecated — use the `to authenticated` clause', { file: fileFor(/auth\.role\s*\(/) }));
  }

  if (usesSupabase && /storage\.from\(|\.storage\b/.test(ctx.code.map((f) => f.content).join('\n')) && !/on\s+storage\.objects/i.test(sql)) {
    results.push(warn('db/storage-policies', 'medium', 'Supabase Storage used but no policies on storage.objects found in migrations', {
      fix: 'Add RLS policies on storage.objects scoped by bucket_id and owner.',
    }));
  }

  const envExample = ctx.first('.env.example', '.env.sample', '.env.template');
  if (envExample && !/DATABASE_URL|SUPABASE_URL|POSTGRES_URL|DB_HOST/.test(envExample.content)) {
    results.push(warn('db/url-documented', 'low', 'No database URL documented in .env.example', { file: envExample.rel }));
  }

  return results;
}

/**
 * Database checks for every data store the project uses:
 * - SQL migrations (Supabase / Postgres): RLS per table, permissive policies, views, definer functions
 * - Firebase, MongoDB, Prisma, Convex, PocketBase, Appwrite (see datastores.ts)
 * - Any server driver imported into browser code, and TLS turned off
 */
export function runDatabaseChecks(ctx: ProjectContext): CheckResult[] {
  const sql = runSqlChecks(ctx);
  const { results: others, detected } = runDataStoreChecks(ctx);
  const results = [...sql, ...others];
  if (results.length === 0) {
    return [info('db/not-applicable', detected.length ? `No database issues found (${detected.join(', ')})` : 'No database or migrations found, skipping database checks')];
  }
  return results;
}
