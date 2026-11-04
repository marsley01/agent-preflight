// Regression tests for false positives found by scanning vercel/nextjs-subscription-payments.
// Each case scans a fixture under test/fixtures through the public scan() API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from '../dist/scan.js';
import { isEnvTemplate } from '../dist/checks/security.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const fixture = (name) => path.join(FIXTURES, name);

const findings = (report) =>
  report.categories.flatMap((c) => c.checks).filter((c) => c.status === 'fail' || c.status === 'warn');

/** Copy a fixture into a fresh git repo with everything committed (or null if git is missing). */
function committedCopy(name, extraFiles = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `preflight-${name}-`));
  fs.cpSync(fixture(name), dir, { recursive: true });
  for (const [rel, content] of Object.entries(extraFiles)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  try {
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git('init', '-q');
    git('add', '-A', '-f');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'fixture');
    return dir;
  } catch {
    fs.rmSync(dir, { recursive: true, force: true });
    return null;
  }
}

/* ---------------- (a) env template files ---------------- */

test('isEnvTemplate recognises template naming conventions', () => {
  for (const f of ['.env.example', '.env.local.example', '.env.sample', '.env.template', 'config/prod.env.template', '.env.dist', '.env.defaults', '.env.tpl']) {
    assert.ok(isEnvTemplate(f), `${f} should be a template`);
  }
  for (const f of ['.env', '.env.local', '.env.production', 'config/.env.staging', 'example.json', 'env.ts']) {
    assert.ok(!isEnvTemplate(f), `${f} should not be a template`);
  }
});

test('(a) committed env templates with placeholder values are not flagged', async (t) => {
  const dir = committedCopy('env-templates');
  if (!dir) return t.skip('git not available');
  try {
    const report = await scan(dir, { only: 'security', offline: true });
    const secrets = findings(report).filter((f) => f.id.startsWith('secrets/') && f.id !== 'secrets/env-gitignored');
    assert.deepEqual(secrets.map((f) => `${f.id} ${f.file}`), []);
    assert.ok(report.categories[0].checks.some((c) => c.id === 'secrets/env-example' && c.status === 'pass'), '.env.local.example counts as documentation');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('(a) a template is still flagged when it holds a real secret value, and real .env files still are', async (t) => {
  const realKey = 'sk_' + 'live_' + '51HxQ2eLkdIwHu7ixA9bC3dE4fG5hI6jK7lM8n';
  const dir = committedCopy('env-templates', {
    '.env.staging.example': `STRIPE_SECRET_KEY=${realKey}\n`,
    '.env.production': 'SECRET=1\n',
  });
  if (!dir) return t.skip('git not available');
  try {
    const report = await scan(dir, { only: 'security', offline: true });
    const ids = findings(report).map((f) => `${f.id} ${f.file}`);
    assert.ok(ids.includes('secrets/stripe-live-key .env.staging.example'), ids.join('\n'));
    assert.ok(ids.includes('secrets/env-committed .env.production'), ids.join('\n'));
    assert.ok(!ids.some((i) => i.startsWith('secrets/env-committed .env.staging.example')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------- (b) UPDATE policies and WITH CHECK ---------------- */

test('(b) UPDATE without WITH CHECK is safe; only an explicitly looser WITH CHECK is flagged', async () => {
  const report = await scan(fixture('update-policy'), { only: 'database', offline: true });
  const hits = findings(report).filter((f) => f.id === 'db/update-with-check');
  assert.equal(hits.length, 1, hits.map((h) => h.message).join('\n'));
  assert.match(hits[0].message, /"update own, rewrite anything"/);
  assert.equal(hits[0].file, 'supabase/migrations/001_policies.sql');
  assert.equal(hits[0].line, 13); // the `create policy` statement
});

/* ---------------- (c) localhost fallbacks ---------------- */

test('(c) localhost after an env var (??, ||, ternary, if-guard) is not flagged; unconditional use is', async () => {
  const report = await scan(fixture('localhost-fallback'), { only: 'ui', offline: true });
  const hits = findings(report).filter((f) => f.id === 'content/localhost-url').map((f) => `${f.file}:${f.line}`);
  assert.deepEqual(hits.sort(), ['src/unconditional.ts:2', 'src/unconditional.ts:3']);
});

/* ---------------- (d) database locations and dedupe ---------------- */

test('(d) database findings carry file:line and identical ones across schema.sql + migrations are reported once', async () => {
  const report = await scan(fixture('db-dedupe'), { only: 'database', offline: true });
  const db = findings(report);
  const both = (f) => [`${f.file}:${f.line}`, ...(f.also ?? []).map((a) => `${a.file}:${a.line}`)].sort();
  const expectBoth = (line) => [`schema.sql:${line}`, `supabase/migrations/20230530034630_init.sql:${line}`];

  const rls = db.filter((f) => f.id === 'db/rls-enabled');
  assert.equal(rls.length, 1, 'todos without RLS reported once');
  assert.match(rls[0].message, /todos/);
  assert.deepEqual(both(rls[0]), expectBoth(4));

  const permissive = db.filter((f) => f.id === 'db/permissive-policy');
  assert.equal(permissive.length, 1);
  assert.deepEqual(both(permissive[0]), expectBoth(8));

  const definer = db.filter((f) => f.id === 'db/definer-search-path');
  assert.equal(definer.length, 1);
  assert.deepEqual(both(definer[0]), expectBoth(10));

  assert.ok(!db.some((f) => f.id === 'db/update-with-check'), 'implicit WITH CHECK is not a finding');
  for (const f of db.filter((x) => x.id !== 'db/storage-policies' && x.id !== 'db/no-migrations')) {
    assert.ok(f.file && f.line, `${f.id} is missing file:line`);
  }
});

test('(d) every location shows up in the pretty, markdown and SARIF output', async () => {
  const { renderReport, renderMarkdown, renderSarif } = await import('../dist/reporter.js');
  const report = await scan(fixture('db-dedupe'), { only: 'database', offline: true });
  const both = 'schema.sql:4, supabase/migrations/20230530034630_init.sql:4';
  assert.ok(renderReport(report).includes(both));
  assert.ok(renderMarkdown(report).includes(both));
  const rls = renderSarif(report).runs[0].results.find((r) => r.ruleId === 'db/rls-enabled');
  assert.equal(rls.relatedLocations[0].physicalLocation.artifactLocation.uri, 'supabase/migrations/20230530034630_init.sql');
});
