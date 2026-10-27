import type { ProjectContext } from '../context.js';
import { type CheckResult, type CheckOptions, type Severity, pass, fail, warn, info } from '../types.js';

interface Pkg {
  name: string;
  version: string;
  ecosystem: 'npm' | 'PyPI';
  source: string;
}

const OSV_BATCH = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN = 'https://api.osv.dev/v1/vulns/';
const TIMEOUT_MS = 20_000;
const MAX_DETAIL_LOOKUPS = 150;

/** Installed versions from npm lockfile v1/v2/v3. */
function parsePackageLock(rel: string, content: string): Pkg[] {
  const out: Pkg[] = [];
  let lock: any;
  try {
    lock = JSON.parse(content);
  } catch {
    return out;
  }
  if (lock.packages) {
    for (const [key, meta] of Object.entries<any>(lock.packages)) {
      if (!key.includes('node_modules/') || !meta?.version || meta.link) continue;
      const name = meta.name ?? key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
      out.push({ name, version: meta.version, ecosystem: 'npm', source: rel });
    }
  } else if (lock.dependencies) {
    const walk = (deps: Record<string, any>) => {
      for (const [name, meta] of Object.entries(deps)) {
        if (meta?.version) out.push({ name, version: meta.version, ecosystem: 'npm', source: rel });
        if (meta?.dependencies) walk(meta.dependencies);
      }
    };
    walk(lock.dependencies);
  }
  return out;
}

/** Only exact `pkg==1.2.3` pins can be checked without resolving. */
function parseRequirements(rel: string, content: string): Pkg[] {
  return content.split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim().match(/^([A-Za-z0-9_.-]+)(\[[^\]]*\])?==([\w.!+-]+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1], version: m[3], ecosystem: 'PyPI' as const, source: rel }));
}

function severityOf(vuln: any): Severity {
  const s = String(vuln?.database_specific?.severity ?? '').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'low') return s;
  if (s === 'moderate' || s === 'medium') return 'medium';
  const score = parseFloat(vuln?.severity?.find((x: any) => /CVSS/.test(x.type))?.score?.match(/\/?(\d+\.\d)$/)?.[1] ?? '');
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return score > 0 ? 'low' : 'medium';
}

function fixedVersion(vuln: any, pkg: Pkg): string | undefined {
  for (const a of vuln?.affected ?? []) {
    if (a.package?.name !== pkg.name) continue;
    for (const r of a.ranges ?? []) {
      const fixed = r.events?.find((e: any) => e.fixed)?.fixed;
      if (fixed) return fixed;
    }
  }
  return undefined;
}

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OSV responded ${res.status}`);
  return res.json();
}

async function queryOsv(pkgs: Pkg[]): Promise<Map<Pkg, string[]>> {
  const hits = new Map<Pkg, string[]>();
  for (let i = 0; i < pkgs.length; i += 1000) {
    const chunk = pkgs.slice(i, i + 1000);
    const data = await postJson(OSV_BATCH, {
      queries: chunk.map((p) => ({ package: { name: p.name, ecosystem: p.ecosystem }, version: p.version })),
    });
    data.results?.forEach((r: any, j: number) => {
      const ids = (r.vulns ?? []).map((v: any) => v.id);
      if (ids.length) hits.set(chunk[j], ids);
    });
  }
  return hits;
}

async function fetchDetails(ids: string[]): Promise<Map<string, any>> {
  const details = new Map<string, any>();
  const queue = ids.slice(0, MAX_DETAIL_LOOKUPS);
  // One deadline for all lookups: on a network that silently drops packets, per-request
  // timeouts would add up to minutes. Whatever hasn't arrived by then uses default severity.
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const worker = async () => {
    for (let id = queue.shift(); id && !deadline.aborted; id = queue.shift()) {
      try {
        const res = await fetch(OSV_VULN + encodeURIComponent(id), { signal: deadline });
        if (res.ok) details.set(id, await res.json());
      } catch {
        // detail lookup failed — fall back to default severity
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return details;
}

function checkManifests(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  for (const f of ctx.find(/(^|\/)package\.json$/)) {
    let p: any;
    try {
      p = JSON.parse(f.content);
    } catch {
      continue;
    }
    const deps = { ...p.dependencies, ...p.devDependencies };
    for (const [name, spec] of Object.entries<string>(deps)) {
      if (spec === '*' || spec === 'latest' || spec === '') {
        results.push(warn('deps/unpinned', 'medium', `${name}@"${spec}" — any future (possibly malicious) release installs automatically`, {
          file: f.rel, fix: `Pin a version range, e.g. "${name}": "^x.y.z".`,
        }));
      } else if (/^(git\+|git:|github:|https?:)/.test(spec) || /^[\w-]+\/[\w.-]+(#.*)?$/.test(spec)) {
        results.push(warn('deps/remote-source', 'low', `${name} installed from ${spec} — bypasses registry integrity and audit`, { file: f.rel }));
      }
    }
    const scripts = p.scripts ?? {};
    for (const hook of ['preinstall', 'install', 'postinstall']) {
      if (scripts[hook] && /curl|wget|bash\s+-c|\|\s*sh|node\s+-e|powershell/i.test(scripts[hook])) {
        results.push(warn('deps/install-script', 'high', `"${hook}" script downloads or executes code: ${scripts[hook].slice(0, 80)}`, { file: f.rel }));
      }
    }
  }
  return results;
}

/**
 * Check dependencies:
 * - Known vulnerabilities (OSV.dev) for npm lockfiles and pinned requirements.txt
 * - Lockfile present
 * - Unpinned / remote-source dependencies, suspicious install scripts
 */
export async function runDependencyChecks(ctx: ProjectContext, opts: CheckOptions = {}): Promise<CheckResult[]> {
  const manifests = ctx.find(/(^|\/)package\.json$/);
  const requirements = ctx.find(/(^|\/)requirements[\w.-]*\.txt$/);
  if (manifests.length === 0 && requirements.length === 0) {
    return [info('deps/not-applicable', 'No package.json or requirements.txt found — skipping dependency checks')];
  }

  const results = checkManifests(ctx);

  if (manifests.length > 0 && ctx.lockfiles.length === 0) {
    results.push(warn('deps/lockfile', 'medium', 'No lockfile committed — every install can resolve different (unaudited) versions', {
      fix: 'Commit package-lock.json / pnpm-lock.yaml / yarn.lock and install with `npm ci` in CI.',
    }));
  }

  const pkgs: Pkg[] = [
    ...ctx.lockfiles.filter((l) => l.endsWith('package-lock.json')).flatMap((l) => parsePackageLock(l, ctx.read(l) ?? '')),
    ...requirements.flatMap((f) => parseRequirements(f.rel, f.content)),
  ];
  const unique = [...new Map(pkgs.map((p) => [`${p.ecosystem}:${p.name}@${p.version}`, p])).values()];

  const otherLocks = ctx.lockfiles.filter((l) => !l.endsWith('package-lock.json'));
  if (otherLocks.length) {
    results.push(info('deps/unsupported-lockfile', `${otherLocks.join(', ')}: run \`pnpm audit\` / \`yarn npm audit\` for advisories (only package-lock.json is audited here)`));
  }

  if (unique.length === 0) return results;
  if (opts.offline) {
    results.push(info('deps/advisories', `Skipped advisory lookup for ${unique.length} packages (--offline)`));
    return results;
  }

  let hits: Map<Pkg, string[]>;
  try {
    hits = await queryOsv(unique);
  } catch (err: any) {
    results.push(warn('deps/advisories', 'low', `Could not reach OSV.dev to check ${unique.length} packages (${err?.message ?? err}) — re-run online or use --offline`));
    return results;
  }

  if (hits.size === 0) {
    results.push(pass('deps/advisories', `No known vulnerabilities in ${unique.length} dependencies (OSV.dev)`));
    return results;
  }

  const details = await fetchDetails([...new Set([...hits.values()].flat())]);
  const rank: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const findings = [...hits].map(([pkg, ids]) => {
    const vulns = ids.map((id) => details.get(id)).filter(Boolean);
    const severity = vulns.length ? rank.find((s) => vulns.some((v) => severityOf(v) === s))! : 'medium';
    const fixes = vulns.map((v) => fixedVersion(v, pkg)).filter(Boolean) as string[];
    const fixTo = fixes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
    const shown = ids.slice(0, 3).join(', ') + (ids.length > 3 ? ` +${ids.length - 3}` : '');
    // Only high/critical CVEs fail (and so trip `--strict`); a low-severity advisory deep in a
    // transitive dependency shouldn't break everyone's CI on upgrade.
    const result = severity === 'critical' || severity === 'high' ? fail : warn;
    return result('deps/vulnerable', severity, `${pkg.name}@${pkg.version} has ${ids.length} known vulnerabilit${ids.length > 1 ? 'ies' : 'y'} (${shown})`, {
      file: pkg.source,
      fix: fixTo
        ? `Upgrade ${pkg.name} to ${fixTo} or later${pkg.ecosystem === 'npm' ? ' (`npm audit fix`, or bump the parent package)' : ` in ${pkg.source}`}.` : `No fixed version published yet — review ${ids[0]} and consider replacing ${pkg.name}.`,
    });
  });
  findings.sort((a, b) => rank.indexOf(a.severity) - rank.indexOf(b.severity));
  results.push(...findings);
  return results;
}
