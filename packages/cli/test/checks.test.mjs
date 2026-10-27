import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ProjectContext, stripLiterals } from '../dist/context.js';
import { runSecurityChecks } from '../dist/checks/security.js';
import { runVulnerabilityChecks } from '../dist/checks/vulnerabilities.js';
import { runDatabaseChecks } from '../dist/checks/database.js';
import { runPaymentChecks } from '../dist/checks/payments.js';
import { runAuthChecks } from '../dist/checks/auth.js';
import { runApiChecks } from '../dist/checks/api.js';
import { runAiChecks } from '../dist/checks/ai.js';
import { runDependencyChecks } from '../dist/checks/dependencies.js';
import { scan, summarize } from '../dist/scan.js';
import { renderSarif, renderMarkdown } from '../dist/reporter.js';

const ids = (results, status) => results.filter((r) => !status || r.status === status).map((r) => r.id);
const ctx = (files) => ProjectContext.fromFiles(files);

// Built at runtime so this file never contains a literal credential.
const AWS_KEY = 'AKIA' + 'Z7XQ4MPLK2RT9WBN';

test('stripLiterals blanks strings and regex literals but keeps code', () => {
  assert.equal(stripLiterals(`const a = "eval(x)"; eval(y)`), `const a = ""; eval(y)`);
  assert.equal(stripLiterals(`re: /eval\\s*\\(/,`), `re: /re/,`);
  assert.equal(stripLiterals(`x = a / b / c`), `x = a / b / c`);
});

test('secrets: real key value is flagged and redacted', () => {
  const r = runSecurityChecks(ctx({ 'src/aws.ts': `const k = "${AWS_KEY}";` }));
  const hit = r.find((x) => x.id === 'secrets/aws-access-key');
  assert.ok(hit, 'AWS key should be flagged');
  assert.equal(hit.severity, 'critical');
  assert.ok(!hit.snippet.includes(AWS_KEY), 'snippet must be redacted');
});

test('secrets: placeholders and env reads are not flagged', () => {
  const r = runSecurityChecks(ctx({
    // Built at runtime: GitHub push protection rejects even placeholder-looking Stripe keys in source.
    'src/a.ts': `const key = process.env.STRIPE_SECRET_KEY;\nconst ex = "${'sk_' + 'live_' + 'x'.repeat(24)}";`,
  }));
  assert.deepEqual(ids(r, 'fail').filter((id) => id.startsWith('secrets/') && id !== 'secrets/env-gitignored'), []);
});

test('secrets: public-prefixed secret env var flagged in code and .env, not as identifier', () => {
  const r = runSecurityChecks(ctx({
    'src/client.ts': 'const s = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;\nconst PUBLIC_SECRET_NAME = 1;',
    '.env.local': 'VITE_SUPABASE_SERVICE_ROLE_KEY=abc',
  }));
  const hits = r.filter((x) => x.id === 'secrets/public-env-secret');
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((h) => h.file).sort(), ['.env.local', 'src/client.ts']);
});

test('preflight-ignore suppresses a finding', () => {
  const r = runSecurityChecks(ctx({ 'src/aws.ts': `// preflight-ignore: test fixture\nconst k = "${AWS_KEY}";` }));
  assert.ok(!r.some((x) => x.id === 'secrets/aws-access-key'));
});

test('vulns: SQL interpolation flagged, tagged templates are not', () => {
  const bad = runVulnerabilityChecks(ctx({ 'src/db.ts': 'await db.query(`SELECT * FROM users WHERE id = ${id}`);' }));
  assert.ok(ids(bad).includes('injection/sql-template'));
  const good = runVulnerabilityChecks(ctx({ 'src/db.ts': 'await sql`SELECT * FROM users WHERE id = ${id}`;' }));
  assert.ok(!ids(good).includes('injection/sql-template'));
});

test('vulns: eval in code flagged, eval inside a string ignored, tests ignored', () => {
  assert.ok(ids(runVulnerabilityChecks(ctx({ 'src/a.ts': 'eval(userInput);' }))).includes('injection/eval'));
  assert.ok(!ids(runVulnerabilityChecks(ctx({ 'src/a.ts': 'const doc = "never call eval(x)";' }))).includes('injection/eval'));
  assert.ok(!ids(runVulnerabilityChecks(ctx({ 'src/a.test.ts': 'eval(x);' }))).includes('injection/eval'));
});

test('vulns: command injection only when child_process is imported', () => {
  const src = 'exec(`git log ${branch}`);';
  assert.ok(ids(runVulnerabilityChecks(ctx({ 'src/a.ts': `import { exec } from 'node:child_process';\n${src}` }))).includes('injection/command'));
  assert.ok(!ids(runVulnerabilityChecks(ctx({ 'src/a.ts': `const re = /x/;\n${src}` }))).includes('injection/command'));
});

test('vulns: CORS wildcard with credentials and TLS disabled', () => {
  const r = runVulnerabilityChecks(ctx({
    'src/server.ts': `app.use(cors({ origin: '*', credentials: true }));\nconst agent = new https.Agent({ rejectUnauthorized: false });`,
  }));
  assert.ok(ids(r).includes('cors/wildcard-with-credentials'));
  assert.ok(ids(r).includes('tls/verification-disabled'));
});

test('database: per-table RLS, permissive policies, views', () => {
  const r = runDatabaseChecks(ctx({
    'supabase/migrations/001.sql': `
      create table public.profiles (id uuid primary key);
      alter table public.profiles enable row level security;
      create policy "own" on public.profiles for select using ((select auth.uid()) = id);
      create table todos (id int);
      create policy "anyone edits" on public.profiles for update using (true);
      create view public.v as select * from profiles;
    `,
  }));
  const fails = r.filter((x) => x.status === 'fail');
  assert.ok(fails.some((f) => f.id === 'db/rls-enabled' && f.message.includes('todos')), 'todos lacks RLS');
  assert.ok(!fails.some((f) => f.id === 'db/rls-enabled' && f.message.includes('profiles')), 'profiles has RLS');
  assert.ok(ids(fails).includes('db/permissive-policy'));
  assert.ok(ids(fails).includes('db/update-with-check'));
  assert.ok(ids(fails).includes('db/view-security-invoker'));
});

test('database: commented-out RLS does not count', () => {
  const r = runDatabaseChecks(ctx({ 'supabase/migrations/m.sql': 'create table posts (id int);\n-- alter table posts enable row level security;' }));
  assert.ok(ids(r, 'fail').includes('db/rls-enabled'));
});

test('payments: webhook without signature verification fails', () => {
  const pkg = JSON.stringify({ dependencies: { stripe: '^14.0.0' } });
  const bad = runPaymentChecks(ctx({ 'package.json': pkg, 'app/api/stripe/webhook/route.ts': 'export async function POST(req) { const e = await req.json(); }' }));
  assert.ok(ids(bad, 'fail').includes('payments/webhook-signature'));
  const good = runPaymentChecks(ctx({ 'package.json': pkg, 'app/api/stripe/webhook/route.ts': 'stripe.webhooks.constructEvent(body, sig, secret); event.id' }));
  assert.ok(ids(good, 'pass').includes('payments/webhook-signature'));
});

test('auth: mutating route without auth is flagged', () => {
  const r = runAuthChecks(ctx({
    'app/api/posts/route.ts': 'export async function DELETE(req) { await prisma.post.delete({ where: { id } }); }',
    'app/api/me/route.ts': 'export async function POST(req) { const { user } = await supabase.auth.getUser(); await db.insert(x); }',
  }));
  const flagged = r.filter((x) => x.id === 'auth/unprotected-mutation').map((x) => x.file);
  assert.deepEqual(flagged, ['app/api/posts/route.ts']);
});

test('api: unvalidated request body is flagged', () => {
  const r = runApiChecks(ctx({ 'app/api/x/route.ts': 'export async function POST(request) { const b = await request.json(); }' }));
  assert.ok(ids(r, 'warn').includes('api/input-validation'));
});

test('ai: browser SDK and not-applicable', () => {
  assert.deepEqual(ids(runAiChecks(ctx({ 'src/a.ts': 'x' }))), ['ai/not-applicable']);
  const r = runAiChecks(ctx({
    'package.json': JSON.stringify({ dependencies: { openai: '^4' } }),
    'src/chat.ts': 'const c = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });',
  }));
  assert.ok(ids(r, 'fail').includes('ai/browser-key'));
});

test('dependencies: offline mode parses lockfile, flags unpinned deps', async () => {
  const r = await runDependencyChecks(ctx({
    'package.json': JSON.stringify({ dependencies: { left: '*' } }),
    'package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/left': { version: '1.0.0' } } }),
  }), { offline: true });
  assert.ok(ids(r).includes('deps/unpinned'));
  assert.ok(r.some((x) => x.id === 'deps/advisories' && x.status === 'info' && x.message.includes('1 packages')));
});

test('summary: score penalizes each rule once', () => {
  const crit = { id: 'a', status: 'fail', severity: 'critical', message: '' };
  const s = summarize([{ id: 'c', name: 'C', checks: [crit, crit, { id: 'b', status: 'pass', severity: 'info', message: '' }] }]);
  assert.equal(s.score, 75);
  assert.equal(s.failed, 2);
  assert.equal(s.bySeverity.critical, 2);
});

test('end to end: scan a temp dir with .preflightignore, render SARIF + markdown', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, 'vendor-ish'));
    fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'eval(input);\n');
    fs.writeFileSync(path.join(dir, 'vendor-ish', 'b.ts'), 'eval(input);\n');
    fs.writeFileSync(path.join(dir, '.preflightignore'), 'vendor-ish/\n');

    const report = await scan(dir, { only: 'vulnerabilities', offline: true });
    const evals = report.categories[0].checks.filter((c) => c.id === 'injection/eval');
    assert.deepEqual(evals.map((e) => e.file), ['src/a.ts']);

    const sarif = renderSarif(report);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs[0].results[0].ruleId, 'injection/eval');
    assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine, 1);
    assert.match(renderMarkdown(report), /src\/a\.ts:1/);

    await assert.rejects(scan(dir, { only: 'nope' }), /Unknown category/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scanning never runs hooks from the scanned repo\'s .git/config (core.fsmonitor)', async (t) => {
  const { execFileSync } = await import('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-trap-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    try {
      git('init', '-q');
    } catch {
      t.skip('git not available');
      return;
    }
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
    git('add', 'a.txt');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
    const marker = path.join(dir, 'pwned').replace(/\\/g, '/');
    git('config', 'core.fsmonitor', `touch "${marker}"; false`);

    await scan(dir, { only: 'security', offline: true });
    assert.ok(!fs.existsSync(marker), 'fsmonitor hook from the scanned repo was executed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
