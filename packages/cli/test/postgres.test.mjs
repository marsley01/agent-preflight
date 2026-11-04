// Postgres / ORM coverage beyond Supabase: stack detection, ORM schemas, browser exposure,
// the new db/* rules (vulnerable + safe fixture each) and the terminal output changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from '../dist/scan.js';
import { ProjectContext } from '../dist/context.js';
import { detectStack, describeStack, rlsFix } from '../dist/stack.js';
import { runDatabaseChecks } from '../dist/checks/database.js';
import { runSecurityChecks } from '../dist/checks/security.js';
import { renderReport, renderSarif } from '../dist/reporter.js';

const FIX = fileURLToPath(new URL('./fixtures/postgres/', import.meta.url));
const ctx = (files) => ProjectContext.fromFiles(files);
const pkg = (deps, scripts = {}) => JSON.stringify({ dependencies: deps, scripts });
const findings = (r) => r.categories.flatMap((c) => c.checks).filter((c) => c.status === 'fail' || c.status === 'warn');
const NEW_RULES = ['db/destructive-script', 'db/hardcoded-url', 'db/owner-role', 'db/pool-per-request', 'injection/sql-raw-variable'];

/* ---------------- Fixture pairs: vulnerable is flagged, safe is not ---------------- */

test('Drizzle + Neon: vulnerable fixture trips every rule', async () => {
  const r = await scan(path.join(FIX, 'drizzle-neon-vulnerable'), { only: 'database,vulnerabilities', offline: true });
  const got = findings(r).map((f) => `${f.id} ${f.file}:${f.line}`);
  for (const expected of [
    'db/rls-enabled src/db/schema.ts:3',
    'db/rls-enabled src/db/schema.ts:8',
    'db/hardcoded-url drizzle.config.ts:7',
    'db/destructive-script package.json:6',
    'db/pool-per-request app/api/posts/route.ts:6',
    'db/owner-role drizzle.config.ts:7',
    'db/owner-role .env.example:1',
    'injection/sql-template app/api/posts/route.ts:9',
  ]) assert.ok(got.includes(expected), `missing ${expected}\n${got.join('\n')}`);
  const rls = findings(r).find((f) => f.id === 'db/rls-enabled');
  assert.equal(rls.severity, 'critical');
  assert.match(rls.message, /Neon Data API/);
  // The password in drizzle.config.ts is reported once, by db/hardcoded-url
  assert.ok(!got.some((g) => g.startsWith('secrets/db-url-password')));
});

test('Drizzle + Neon: safe fixture trips none of them', async () => {
  const r = await scan(path.join(FIX, 'drizzle-neon-safe'), { only: 'database,vulnerabilities,security', offline: true });
  const db = findings(r).filter((f) => f.id.startsWith('db/') || f.id.startsWith('injection/') || f.id.startsWith('secrets/'));
  assert.deepEqual(db.map((f) => `${f.id} ${f.file}:${f.line}`), []);
  // pgTable.withRLS('users') without policies is default-deny: informational only
  const users = r.categories.flatMap((c) => c.checks).find((c) => c.id === 'db/rls-no-policy');
  assert.equal(users.status, 'info');
});

test('Prisma + Kysely on Railway: vulnerable fixture trips every rule', async () => {
  const r = await scan(path.join(FIX, 'prisma-railway-vulnerable'), { only: 'database,vulnerabilities', offline: true });
  const got = findings(r).map((f) => `${f.id} ${f.file}:${f.line}`);
  for (const expected of [
    'db/hardcoded-url prisma/schema.prisma:3',
    'db/destructive-script package.json:6',
    'db/destructive-script .github/workflows/deploy.yml:10',
    'db/pool-per-request app/api/users/route.ts:4',
    'db/owner-role prisma/schema.prisma:3',
    'injection/sql-raw-variable src/report.ts:4',
  ]) assert.ok(got.includes(expected), `missing ${expected}\n${got.join('\n')}`);
  assert.match(findings(r).find((f) => f.file === 'package.json').message, /postinstall.*accept-data-loss/);
});

test('Prisma + Kysely on Railway: safe fixture trips none of them (manual reset script, test-only CI, sql.raw literal)', async () => {
  const r = await scan(path.join(FIX, 'prisma-railway-safe'), { only: 'database,vulnerabilities', offline: true });
  assert.deepEqual(findings(r).map((f) => `${f.id} ${f.file}:${f.line}`), []);
  // Server-only app: tables without RLS stay informational
  const rls = r.categories.flatMap((c) => c.checks).find((c) => c.id === 'db/rls-enabled');
  assert.equal(rls.status, 'info');
  assert.ok(!NEW_RULES.some((id) => r.categories.flatMap((c) => c.checks).some((c) => c.id === id && c.status !== 'pass')));
});

/* ---------------- Stack detection and platform-specific fixes ---------------- */

test('stack detection: providers, ORMs and browser exposure', () => {
  const neon = detectStack(ctx({ 'package.json': pkg({ next: '15', 'drizzle-orm': '1', '@neondatabase/serverless': '1' }) }));
  assert.equal(describeStack(neon), 'Next.js · Drizzle · Neon Postgres');
  assert.deepEqual(neon.browserAccess, []);

  const dataApi = detectStack(ctx({ 'package.json': pkg({ '@neon/neon-js': '0.1' }) }));
  assert.deepEqual(dataApi.browserAccess, ['Neon Data API']);

  const railway = detectStack(ctx({ 'package.json': pkg({ express: '5', pg: '8' }), '.env.example': 'DATABASE_URL=postgresql://app:x@monorail.proxy.rlwy.net:5432/railway' }));
  assert.equal(describeStack(railway), 'Express · node-postgres · Railway Postgres');

  const rds = detectStack(ctx({ 'package.json': pkg({ knex: '3' }), 'knexfile.js': "connection: 'postgres://u@db.abc.eu-west-1.rds.amazonaws.com/app'" }));
  assert.equal(rds.provider, 'rds');

  const supabase = detectStack(ctx({ 'package.json': pkg({ '@supabase/supabase-js': '2', 'drizzle-orm': '1' }) }));
  assert.equal(supabase.provider, 'supabase');
  assert.deepEqual(supabase.browserAccess, ['Supabase client']);

  const postgrest = detectStack(ctx({ 'docker-compose.yml': 'services:\n  api:\n    image: postgrest/postgrest:v12\n', 'package.json': pkg({ pg: '8' }) }));
  assert.deepEqual(postgrest.browserAccess, ['PostgREST']);

  const hasura = detectStack(ctx({ '.env.example': 'HASURA_GRAPHQL_ADMIN_SECRET=\n', 'package.json': pkg({ pg: '8' }) }));
  assert.deepEqual(hasura.browserAccess, ['Hasura']);
});

test('fix hints match the platform: no auth.uid() for Neon users', () => {
  const neon = detectStack(ctx({ 'package.json': pkg({ '@neon/neon-js': '0.1', 'drizzle-orm': '1' }) }));
  assert.match(rlsFix(neon, 'notes'), /crudPolicy/);
  assert.doesNotMatch(rlsFix(neon, 'notes'), /auth\.uid\(\)/);

  const neonSql = runDatabaseChecks(ctx({
    'package.json': pkg({ '@neon/neon-js': '0.1' }),
    'migrations/001.sql': 'create table notes (id int, user_id text);\nalter table notes enable row level security;\ncreate policy "all" on notes for all using (true);',
  }));
  const fix = neonSql.find((f) => f.id === 'db/permissive-policy').fix;
  assert.match(fix, /auth\.user_id\(\)/);
  assert.doesNotMatch(fix, /auth\.uid\(\)/);

  const supa = runDatabaseChecks(ctx({
    'package.json': pkg({ '@supabase/supabase-js': '2' }),
    'supabase/migrations/001.sql': 'create table notes (id int);',
  }));
  assert.match(supa.find((f) => f.id === 'db/rls-enabled').fix, /auth\.uid\(\)/);
});

/* ---------------- ORM schemas ---------------- */

test('Drizzle RLS is recognised in every documented form', () => {
  const r = runDatabaseChecks(ctx({
    'package.json': pkg({ '@neon/neon-js': '0.1', 'drizzle-orm': '1' }),
    'src/schema.ts': [
      "export const a = pgTable.withRLS('a', { id: integer() });",
      "export const b = pgTable('b', { id: integer() }, (t) => [pgPolicy('p', { for: 'select', using: sql`true` })]);",
      "export const c = pgTable('c', { id: integer() }, (t) => [crudPolicy({ role: authenticatedRole, read: true, modify: false })]);",
      "export const d = pgTable('d', { id: integer() });",
      "export const dPolicy = pgPolicy('d_read', { for: 'select' }).link(d);",
      "export const e = pgTable('e', { id: integer() }).enableRLS();",
      "export const open = pgTable('open', { id: integer() });",
    ].join('\n'),
  }));
  const missing = r.filter((f) => f.id === 'db/rls-enabled' && f.status === 'fail').map((f) => f.message.split(' ')[1]);
  assert.deepEqual(missing, ['open']);
});

test('Prisma models behind Supabase need RLS from SQL migrations', () => {
  const schema = 'model Invoice {\n  id Int @id\n  @@map("invoices")\n}';
  const exposed = runDatabaseChecks(ctx({ 'package.json': pkg({ '@supabase/supabase-js': '2', '@prisma/client': '6' }), 'prisma/schema.prisma': schema }));
  const hit = exposed.find((f) => f.id === 'db/rls-enabled' && f.status === 'fail');
  assert.ok(hit && /invoices/.test(hit.message) && hit.file === 'prisma/schema.prisma');
  const fixed = runDatabaseChecks(ctx({
    'package.json': pkg({ '@supabase/supabase-js': '2', '@prisma/client': '6' }),
    'prisma/schema.prisma': schema,
    'prisma/migrations/2_rls/migration.sql': 'alter table "invoices" enable row level security;\ncreate policy "own" on invoices for select using (true);',
  }));
  assert.ok(!fixed.some((f) => f.id === 'db/rls-enabled' && f.status === 'fail'));
});

/* ---------------- Rule edge cases ---------------- */

test('db/hardcoded-url ignores env lookups and local dev databases', () => {
  const r = runDatabaseChecks(ctx({
    'package.json': pkg({ 'drizzle-orm': '1', knex: '3' }),
    'drizzle.config.ts': "dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/dev' }",
    'knexfile.js': "connection: 'postgres://postgres:postgres@db:5432/app'",
  }));
  assert.ok(!r.some((f) => f.id === 'db/hardcoded-url' || f.id === 'db/owner-role'));
});

test('db/pool-per-request: module-level and Neon serverless clients are fine', () => {
  const r = runDatabaseChecks(ctx({
    'package.json': pkg({ pg: '8', '@neondatabase/serverless': '1', postgres: '3' }),
    'app/api/a/route.ts': "import { Pool } from 'pg';\nconst pool = new Pool();\nexport async function GET() {\n  return pool.query('select 1');\n}",
    'app/api/b/route.ts': "import { Pool } from '@neondatabase/serverless';\nexport async function GET() {\n  const pool = new Pool({ connectionString: process.env.DATABASE_URL });\n}",
    'app/api/c/route.ts': "import postgres from 'postgres';\nexport async function POST() {\n  const sql = postgres(process.env.DATABASE_URL);\n}",
  }));
  assert.deepEqual(r.filter((f) => f.id === 'db/pool-per-request').map((f) => f.file), ['app/api/c/route.ts']);
});

test('secrets/db-url-password still fires outside ORM config, including hosts named db.*', () => {
  const r = runSecurityChecks(ctx({
    'src/db.ts': "const url = 'postgres://app:Sup3rS3cretPw@db.prod.acme-corp.net/app';",
    'src/local.ts': "const dev = 'postgres://app:Sup3rS3cretPw@db:5432/app';",
  }));
  // A host that merely starts with "db." is a real server; the compose service "db" is local
  assert.deepEqual(r.filter((f) => f.id === 'secrets/db-url-password').map((f) => f.file), ['src/db.ts']);
});

/* ---------------- Output ---------------- */

test('pretty output: Detected line, skipped categories, collapsed passes, merged duplicates', async () => {
  const report = await scan(path.join(FIX, 'drizzle-neon-vulnerable'), { offline: true });
  const out = renderReport(report).replace(/\x1b\[[0-9;]*m/g, '');
  assert.match(out, /Detected: Next\.js · Drizzle · Neon Postgres · browser access via Neon Data API/);
  assert.match(out, /Skipped 4 categories not used by this project \(Payments, AI \/ LLM, GraphQL, Real-Time\)/);
  assert.doesNotMatch(out, /No payment integration detected/);
  assert.match(out, /✅ {2}3 checks passed/);
  assert.match(out, /owner role "neondb_owner".*\(drizzle\.config\.ts:7, \.env\.example:1\)/);

  const verbose = renderReport(report, { verbose: true }).replace(/\x1b\[[0-9;]*m/g, '');
  assert.match(verbose, /\.env is gitignored/);
});

test('JSON and SARIF keep their shape: no stack field, no terminal-only merging', async () => {
  const report = await scan(path.join(FIX, 'drizzle-neon-vulnerable'), { offline: true });
  const json = JSON.parse(JSON.stringify({ ...report, stack: undefined }));
  assert.equal(json.stack, undefined);
  const owner = json.categories.flatMap((c) => c.checks).filter((c) => c.id === 'db/owner-role');
  assert.equal(owner.length, 2, 'JSON keeps one entry per location');
  const sarif = renderSarif(report);
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results.filter((r) => r.ruleId === 'db/owner-role').length, 2);
});
