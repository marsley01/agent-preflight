import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const checksDir = new URL('../src/checks/', import.meta.url);
const rulesDoc = fs.readFileSync(new URL('../../../docs/rules.md', import.meta.url), 'utf-8');

/** Every rule ID that can surface as a finding (fail/warn), read straight from the source. */
function findingRuleIds() {
  const ids = new Set();
  for (const name of fs.readdirSync(checksDir)) {
    const src = fs.readFileSync(new URL(name, checksDir), 'utf-8');
    // `result(...)` is a fail-or-warn picked at runtime (e.g. dependency CVEs by severity).
    for (const m of src.matchAll(/\b(?:fail|warn|result|capped)\(\s*'([a-z0-9-]+\/[a-z0-9-]+)'/g)) ids.add(m[1]);
    // Detector tables (vulnerabilities.ts, web.ts headers) declare `id: 'category/rule'`.
    for (const m of src.matchAll(/\bid:\s*'([a-z-]+\/[a-z0-9-]+)'/g)) ids.add(m[1]);
    // Secret patterns are emitted as `secrets/${id}`.
    if (name === 'security.ts') {
      for (const m of src.matchAll(/\{\s*id:\s*'([a-z0-9-]+)',\s*label:/g)) ids.add(`secrets/${m[1]}`);
    }
  }
  return [...ids];
}

test('every finding rule ID is documented in docs/rules.md', () => {
  const ids = findingRuleIds();
  assert.ok(ids.length > 50, `expected to find the rule set, got ${ids.length}`);
  const missing = ids.filter((id) => !rulesDoc.includes(`\`${id}\``));
  assert.deepEqual(missing, [], `Add these rule IDs to docs/rules.md: ${missing.join(', ')}`);
});

test('docs/rules.md does not list rules that no longer exist', () => {
  const ids = new Set(findingRuleIds());
  const documented = [...rulesDoc.matchAll(/^\| `([a-z-]+\/[a-z0-9-]+)` \|/gm)].map((m) => m[1]);
  const stale = documented.filter((id) => !ids.has(id));
  assert.deepEqual(stale, [], `Remove or rename these in docs/rules.md: ${stale.join(', ')}`);
});
