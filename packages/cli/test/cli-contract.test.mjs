// Contract tests: the CLI interface people already depend on (0.1.x) must keep working.
// These run the real binary, the way `npx @preflight-agent/cli` users and CI scripts call it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

function run(args, cwd) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-cli-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const vulnerable = {
  '.gitignore': '.env*\n',
  'package.json': JSON.stringify({ dependencies: { next: '15.0.0' } }),
  'lib/db.ts': 'export const q = (id: string) => db.query(`SELECT * FROM t WHERE id = ${id}`);\n',
};
const clean = { '.gitignore': '.env*\n', 'src/index.ts': 'export const x = 1;\n' };

test('`--version` matches package.json', () => {
  const r = run(['--version']);
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('`scan --json` keeps the 0.1.x shape: bare array of { name, checks[{ status, message }] }', () => {
  const dir = fixture(vulnerable);
  try {
    const r = run(['scan', dir, '--json', '--offline']);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout); // stdout must be pure JSON: no spinner or banner
    assert.ok(Array.isArray(out), '--json must print an array');
    for (const cat of out) {
      assert.equal(typeof cat.name, 'string');
      assert.ok(Array.isArray(cat.checks));
      for (const c of cat.checks) {
        assert.ok(['pass', 'fail', 'warn'].includes(c.status), `unexpected status ${c.status}`);
        assert.equal(typeof c.message, 'string');
        if (c.file !== undefined) assert.equal(typeof c.file, 'string');
        if (c.line !== undefined) assert.equal(typeof c.line, 'number');
      }
    }
    const names = out.map((c) => c.name);
    for (const legacy of ['Security', 'Authentication', 'Payments', 'Database', 'API & Validation', 'Web Security', 'GraphQL', 'Real-Time', 'Vulnerabilities']) {
      assert.ok(names.includes(legacy), `missing 0.1.x category "${legacy}"`);
    }
    const sqli = out.flatMap((c) => c.checks).find((c) => c.id === 'injection/sql-template');
    assert.ok(sqli && sqli.status === 'fail' && sqli.file === 'lib/db.ts' && sqli.line === 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('`--format json` gives the full report object', () => {
  const dir = fixture(clean);
  try {
    const r = run(['scan', dir, '--format', 'json', '--offline']);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.tool.version, pkg.version);
    assert.ok(Array.isArray(out.categories) && typeof out.summary.score === 'number');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('`--strict` exits 1 on failures and 0 when clean', () => {
  const bad = fixture(vulnerable);
  const good = fixture(clean);
  try {
    assert.equal(run(['scan', bad, '--strict', '--offline']).code, 1);
    assert.equal(run(['scan', good, '--strict', '--offline']).code, 0);
    assert.equal(run(['scan', bad, '--offline']).code, 0, 'without --strict/--fail-on the exit code stays 0');
  } finally {
    fs.rmSync(bad, { recursive: true, force: true });
    fs.rmSync(good, { recursive: true, force: true });
  }
});

test('`--only` accepts every 0.1.x category id, case-insensitively', () => {
  const dir = fixture(clean);
  try {
    for (const id of ['security', 'auth', 'payments', 'database', 'api', 'web', 'graphql', 'realtime', 'vulnerabilities', 'Security']) {
      const r = run(['scan', dir, '--only', id, '--json', '--offline']);
      assert.equal(r.code, 0, `--only ${id}: ${r.stderr}`);
      assert.equal(JSON.parse(r.stdout).length, 1);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('`scan` with no dir scans the current directory', () => {
  const dir = fixture(vulnerable);
  try {
    const r = run(['scan', '--json', '--offline'], dir);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(JSON.parse(r.stdout).flatMap((c) => c.checks).some((c) => c.file === 'lib/db.ts'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bad input fails loudly with a non-zero exit, not a stack trace', () => {
  const missing = run(['scan', path.join(os.tmpdir(), 'definitely-not-here-preflight'), '--offline']);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /Not a directory/);
  assert.doesNotMatch(missing.stderr, /at .*\.js:\d+/);

  const badCat = run(['scan', '.', '--only', 'nope', '--offline']);
  assert.notEqual(badCat.code, 0);
  assert.match(badCat.stderr, /Unknown category/);
});
