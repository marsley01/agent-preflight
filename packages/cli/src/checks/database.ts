import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, fail, warn, info } from '../types.js';
import { runDataStoreChecks } from './datastores.js';
import { drizzleTables, prismaTables } from './orm-schema.js';
import { detectStack, ownerPredicate, rlsFix } from '../stack.js';

const CREATE_TABLE = /create\s+table\s+(if\s+not\s+exists\s+)?((?:"?\w+"?\.)?"?(\w+)"?)/gi;

interface Loc {
  file: string;
  line: number;
}

/** A matched SQL statement and every place an identical copy of it appears. */
interface Found {
  match: RegExpMatchArray;
  locs: Loc[];
}

/** Blank out `--` and `/* *\/` comments, keeping offsets and newlines so line numbers stay right. */
function maskSqlComments(sql: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  return sql.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/--[^\n]*/g, blank);
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Run `re` over every SQL file and group identical statements, so a policy that appears in both
 * schema.sql and a migration is reported once with both locations.
 */
function findAll(files: Array<{ rel: string; masked: string }>, re: RegExp, key: (m: RegExpMatchArray) => string = (m) => normalize(m[0])): Found[] {
  const groups = new Map<string, Found>();
  for (const f of files) {
    for (const m of f.masked.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      const loc = { file: f.rel, line: f.masked.slice(0, m.index).split('\n').length };
      const k = key(m);
      const g = groups.get(k);
      if (g) g.locs.push(loc);
      else groups.set(k, { match: m, locs: [loc] });
    }
  }
  return [...groups.values()];
}

/** file/line of the first occurrence, plus `also` for the rest. */
function at(locs: Loc[]): { file?: string; line?: number; also?: Loc[] } {
  if (locs.length === 0) return {};
  return { file: locs[0].file, line: locs[0].line, ...(locs.length > 1 ? { also: locs.slice(1) } : {}) };
}

/**
 * Check SQL migrations (Supabase / Postgres) for data exposure:
 * - Every created table has RLS enabled (per table, not just "somewhere")
 * - Tables with RLS have at least one policy
 * - Permissive `using (true)` policies on writes
 * - UPDATE policies whose WITH CHECK is looser than USING
 * - Views without security_invoker, SECURITY DEFINER functions without search_path
 * - Deprecated auth.role()
 * Every finding points at file:line; identical statements across files are reported once.
 */
function runSqlChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const sqlFiles = ctx.sql;
  const stack = detectStack(ctx);
  // RLS only matters when browsers can reach the database directly (Supabase, Neon Data API,
  // PostgREST, Hasura). Apps that only connect from the server are protected by their API layer.
  const usesSupabase = stack.provider === 'supabase' || ctx.allPaths.some((p) => /(^|\/)supabase\/.+\.(sql|toml)$/.test(p));
  const exposure = usesSupabase ? ['Supabase client', ...stack.browserAccess.filter((b) => b !== 'Supabase client')] : stack.browserAccess;
  const ormTables = [...drizzleTables(ctx), ...prismaTables(ctx)];

  if (sqlFiles.length === 0 && ormTables.length === 0) {
    return usesSupabase
      ? [warn('db/no-migrations', 'medium', 'Supabase used but no SQL migrations in the repo, so RLS cannot be verified', {
        fix: 'Run `supabase db pull` so your schema and policies are version-controlled and reviewable.',
      })]
      : [];
  }

  const files = sqlFiles.map((f) => ({ rel: f.rel, masked: maskSqlComments(f.content) }));
  const sql = files.map((f) => f.masked).join('\n');

  // --- Table inventory: SQL migrations + Drizzle tables + Prisma models, merged by name ---
  interface Table { name: string; locs: Loc[]; rls: boolean; policy: boolean }
  const tables = new Map<string, Table>();
  const add = (name: string, locs: Loc[], rls: boolean, policy: boolean) => {
    const key = name.toLowerCase();
    const t = tables.get(key) ?? { name, locs: [], rls: false, policy: false };
    t.locs.push(...locs);
    t.rls ||= rls;
    t.policy ||= policy;
    tables.set(key, t);
  };
  for (const t of findAll(files, CREATE_TABLE, (m) => m[3].toLowerCase())) {
    const full = t.match[2].replace(/"/g, '');
    if (full.includes('.') && full.split('.')[0] !== 'public') continue;
    add(full, t.locs, false, false);
  }
  for (const t of ormTables) add(t.name, [{ file: t.file, line: t.line }], t.rls, t.policy);

  // RLS may be enabled in a later SQL migration (including drizzle-kit / prisma generated ones).
  const missingRls: Table[] = [];
  const missingPolicy: Table[] = [];
  for (const t of tables.values()) {
    const name = `(?:"?public"?\\.)?"?${t.name.split('.').pop()}"?`;
    const rlsOn = t.rls || new RegExp(`alter\\s+table\\s+(if\\s+exists\\s+)?(only\\s+)?${name}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql);
    const hasPolicy = t.policy || new RegExp(`create\\s+policy[\\s\\S]*?\\bon\\s+${name}\\b`, 'i').test(sql);
    if (!rlsOn) missingRls.push(t);
    else if (!hasPolicy) missingPolicy.push(t);
  }

  if (tables.size > 0 && missingRls.length === 0) {
    results.push(pass('db/rls-enabled', `RLS enabled on all ${tables.size} public tables`));
  }
  if (exposure.length === 0 && missingRls.length > 0) {
    results.push(info('db/rls-enabled', `${missingRls.length} table(s) without RLS: fine while only your server connects to the database; enable it before exposing the DB to clients`));
    missingRls.length = 0;
  }
  const how = exposure.length === 1 && exposure[0] === 'Supabase client' ? 'anyone with the anon key' : `anyone through the ${exposure.join(' / ')}`;
  for (const t of missingRls) {
    results.push(fail('db/rls-enabled', 'critical', `Table ${t.name} has no RLS: readable and writable by ${how}`, {
      ...at(t.locs),
      fix: rlsFix(stack, t.name),
    }));
  }
  for (const t of missingPolicy) {
    results.push(info('db/rls-no-policy', `Table ${t.name} has RLS but no policies: all access denied (fine if only the service role uses it)`, at(t.locs)));
  }

  // --- Policies ---
  for (const { match, locs } of findAll(files, /create\s+policy\s+("[^"]+"|\w+)[\s\S]*?;/gi)) {
    const p = match[0];
    const name = match[1];
    const usingTrue = /using\s*\(\s*true\s*\)/i.test(p);
    const checkTrue = /with\s+check\s*\(\s*true\s*\)/i.test(p);
    if (/for\s+(all|update|delete)\b/i.test(p) && usingTrue) {
      results.push(fail('db/permissive-policy', 'critical', `Policy ${name} allows any user to modify or delete every row (using (true))`, {
        ...at(locs),
        fix: `Scope the policy to the owner, e.g. \`using (${ownerPredicate(stack)})\`.`,
      }));
    }
    // Without WITH CHECK, Postgres re-applies USING to the new row, which is safe. Only an
    // explicit WITH CHECK that is looser than USING lets users rewrite rows into anything.
    if (/for\s+(all|update)\b/i.test(p) && checkTrue && !usingTrue) {
      results.push(fail('db/update-with-check', 'high', `Policy ${name} has WITH CHECK (true), looser than its USING clause: users can rewrite rows they own, e.g. hand them to another user_id`, {
        ...at(locs),
        fix: `Remove the WITH CHECK clause (Postgres then reuses USING), or make it match USING, e.g. \`with check (${ownerPredicate(stack)})\`.`,
      }));
    }
    if (/for\s+insert\b/i.test(p) && /to\s+[^;]*\banon\b/i.test(p) && checkTrue) {
      results.push(warn('db/anon-insert', 'medium', `Policy ${name} lets anonymous users insert arbitrary rows (including any user_id)`, {
        ...at(locs),
        fix: `Constrain it, e.g. \`with check (user_id is null or ${ownerPredicate(stack)})\`, and add rate limiting.`,
      }));
    }
  }

  // --- Views, functions, deprecated helpers ---
  for (const { match: v, locs } of findAll(files, /create\s+(or\s+replace\s+)?view\s+([\w."]+)([^;]*)/gi)) {
    if (!/security_invoker\s*=\s*(true|on)/i.test(v[3])) {
      results.push(fail('db/view-security-invoker', 'high', `View ${v[2]} runs as its owner and bypasses RLS`, {
        ...at(locs),
        fix: `create view ${v[2]} with (security_invoker = true) as ...`,
      }));
    }
  }

  // A function body runs until the next `create function` in the same file.
  const definers = new Map<string, { name: string; locs: Loc[] }>();
  for (const f of files) {
    const starts = [...f.masked.matchAll(/create\s+(or\s+replace\s+)?function\s+([\w."]+)/gi)];
    for (const [i, fn] of starts.entries()) {
      const body = f.masked.slice(fn.index, starts[i + 1]?.index ?? f.masked.length);
      if (!/security\s+definer/i.test(body) || /set\s+search_path/i.test(body)) continue;
      const key = normalize(body);
      const loc = { file: f.rel, line: f.masked.slice(0, fn.index).split('\n').length };
      const existing = definers.get(key);
      if (existing) existing.locs.push(loc);
      else definers.set(key, { name: fn[2], locs: [loc] });
    }
  }
  for (const { name, locs } of definers.values()) {
    results.push(warn('db/definer-search-path', 'medium', `SECURITY DEFINER function ${name} without a fixed search_path: privilege escalation risk`, {
      ...at(locs),
      fix: "Add `set search_path = ''` and fully qualify objects inside the function.",
    }));
  }

  const authRole = findAll(files, /auth\.role\s*\(/gi, (m) => String(m.index)).flatMap((g) => g.locs);
  if (authRole.length > 0) {
    results.push(warn('db/auth-role-deprecated', 'low', 'auth.role() in policies is deprecated: use the `to authenticated` clause', at(authRole)));
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
