import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** A text file loaded from the scanned project. Paths are always posix-style and relative. */
export interface SourceFile {
  rel: string;
  content: string;
  lines: string[];
}

/** A single line-level match produced by {@link ProjectContext.grep}. */
export interface LineMatch {
  file: string;
  line: number;
  text: string;
  match: RegExpExecArray;
}

/** Directories that never contain first-party source worth scanning. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo',
  '.vercel', '.netlify', '.output', 'coverage', '.cache', '.parcel-cache', 'vendor', 'venv',
  '.venv', '__pycache__', '.idea', '.vscode', 'storybook-static', '.expo', 'target',
]);

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|astro|json|sql|prisma|graphql|gql|ya?ml|toml|html|css|scss|sass|less|rules|py|rb|go|php|conf|txt)$/i;
const TEXT_NAMES = /^(Dockerfile.*|\.gitignore|\.env.*|\.htaccess|web\.config|Procfile|\.npmrc|\.preflightignore)$/;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|astro)$/i;
const TEST_PATH = /(^|\/)(__tests__|__mocks__|tests?|fixtures|e2e|cypress|playwright)\/|\.(test|spec|stories)\.[cm]?[jt]sx?$/i;
const MINIFIED = /\.min\.[cm]?js$|\.d\.ts$/;
const LOCKFILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock']);

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_LOCKFILE_BYTES = 30 * 1024 * 1024;
const IGNORE_DIRECTIVE = /preflight-ignore/;
/**
 * A scanned repo's own .git/config could set hooks that git runs on read commands
 * (core.fsmonitor executes a program on `ls-files`). Override them so scanning never executes code.
 */
const SAFE_GIT = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never'];
const STRING_LITERAL = /(["'])(?:\\.|(?!\1)[^\\\n])*\1/g;
const REGEX_LITERAL = /(?<=[=:(,!&|?]\s*)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\n])*\]|[^/\n\\[])+\/[dgimsuyv]*/g;

/** Blank out quoted strings and regex literals so patterns only match real code. */
export function stripLiterals(line: string): string {
  return line.replace(STRING_LITERAL, '$1$1').replace(REGEX_LITERAL, '/re/');
}

export interface GrepOptions {
  /** Match inside string and regex literals too (default: code only). */
  literals?: boolean;
}

/** Convert a simple gitignore-style glob (`*`, `**`, trailing `/`) into a regex over posix paths. */
function globToRegex(pattern: string): RegExp {
  let p = pattern.trim().replace(/^\.?\//, '');
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const body = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\/?/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(.*/)?');
  const anchored = p.includes('/') ? `^${body}` : `(^|/)${body}`;
  return new RegExp(`${anchored}(/|$)`);
}

/**
 * Everything a check needs to know about the project, loaded once up front.
 * Checks never touch the filesystem directly, which keeps them fast and testable.
 */
export class ProjectContext {
  readonly root: string;
  readonly files = new Map<string, SourceFile>();
  /** Every file path in the project (including binaries and lockfiles we didn't load). */
  readonly allPaths: string[] = [];
  readonly lockfiles: string[] = [];
  private ignores: RegExp[] = [];
  private pkgCache?: Record<string, any> | null;
  private depsCache = new Map<string, Set<string>>();

  private constructor(root: string) {
    this.root = root;
  }

  static load(root: string): ProjectContext {
    const ctx = new ProjectContext(root);
    const ignoreFile = path.join(root, '.preflightignore');
    if (fs.existsSync(ignoreFile)) {
      ctx.ignores = fs.readFileSync(ignoreFile, 'utf-8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .map(globToRegex);
    }
    ctx.walk('');
    return ctx;
  }

  /** Build a context from in-memory files (used by tests). */
  static fromFiles(files: Record<string, string>, root = '/virtual'): ProjectContext {
    const ctx = new ProjectContext(root);
    for (const [rel, content] of Object.entries(files)) {
      ctx.allPaths.push(rel);
      if (LOCKFILES.has(path.posix.basename(rel))) ctx.lockfiles.push(rel);
      ctx.files.set(rel, { rel, content, lines: content.split(/\r?\n/) });
    }
    return ctx;
  }

  private walk(relDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(this.root, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (this.ignores.some((re) => re.test(rel))) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) this.walk(rel);
        continue;
      }
      if (!entry.isFile()) continue;
      this.allPaths.push(rel);

      const isLock = LOCKFILES.has(entry.name);
      if (isLock) this.lockfiles.push(rel);
      if (!TEXT_EXT.test(entry.name) && !TEXT_NAMES.test(entry.name)) continue;

      const abs = path.join(this.root, rel);
      try {
        const size = fs.statSync(abs).size;
        if (size > (isLock ? MAX_LOCKFILE_BYTES : MAX_FILE_BYTES)) continue;
        const content = fs.readFileSync(abs, 'utf-8');
        if (content.includes('\u0000')) continue; // binary
        this.files.set(rel, { rel, content, lines: content.split(/\r?\n/) });
      } catch {
        // unreadable file — skip
      }
    }
  }

  read(rel: string): string | undefined {
    return this.files.get(rel)?.content;
  }

  exists(rel: string): boolean {
    return this.allPaths.includes(rel);
  }

  /** First existing file among candidates. */
  first(...candidates: string[]): SourceFile | undefined {
    for (const c of candidates) {
      const f = this.files.get(c);
      if (f) return f;
    }
    return undefined;
  }

  /** Loaded files whose path matches the regex. */
  find(re: RegExp): SourceFile[] {
    return [...this.files.values()].filter((f) => re.test(f.rel));
  }

  /** First-party application code: no tests, fixtures, minified bundles or type declarations. */
  get code(): SourceFile[] {
    return [...this.files.values()].filter(
      (f) => CODE_EXT.test(f.rel) && !TEST_PATH.test(f.rel) && !MINIFIED.test(f.rel),
    );
  }

  get sql(): SourceFile[] {
    return this.find(/\.sql$/i);
  }

  /** Root package.json, parsed (null if missing or invalid). */
  get pkg(): Record<string, any> | null {
    if (this.pkgCache !== undefined) return this.pkgCache;
    try {
      this.pkgCache = JSON.parse(this.read('package.json') ?? 'null');
    } catch {
      this.pkgCache = null;
    }
    return this.pkgCache ?? null;
  }

  /** Names of all dependencies declared in any package.json in the project. */
  get dependencyNames(): Set<string> {
    const names = new Set<string>();
    for (const f of this.find(/(^|\/)package\.json$/)) {
      try {
        const p = JSON.parse(f.content);
        for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
          Object.keys(p[k] ?? {}).forEach((n) => names.add(n));
        }
      } catch {
        // malformed package.json — skip
      }
    }
    return names;
  }

  /** Dependencies of the package.json nearest to `rel` (the workspace a file belongs to). */
  depsFor(rel: string): Set<string> {
    let dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    for (;;) {
      const cached = this.depsCache.get(dir);
      if (cached) return cached;
      const manifest = this.files.get(dir ? `${dir}/package.json` : 'package.json');
      if (manifest || !dir) {
        const deps = new Set<string>();
        try {
          const p = JSON.parse(manifest?.content ?? '{}');
          for (const k of ['dependencies', 'devDependencies', 'peerDependencies']) Object.keys(p[k] ?? {}).forEach((n) => deps.add(n));
        } catch {
          // malformed package.json
        }
        this.depsCache.set(dir, deps);
        return deps;
      }
      dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    }
  }

  hasDependency(...names: (string | RegExp)[]): boolean {
    const deps = [...this.dependencyNames];
    return names.some((n) => deps.some((d) => (typeof n === 'string' ? d === n : n.test(d))));
  }

  /**
   * Line-by-line regex search. Skips comment-only lines and lines suppressed with a
   * `preflight-ignore` comment on the same or previous line.
   */
  grep(files: SourceFile[], re: RegExp, opts: GrepOptions = {}): LineMatch[] {
    const out: LineMatch[] = [];
    const flags = re.flags.replace('g', '');
    for (const f of files) {
      for (let i = 0; i < f.lines.length; i++) {
        const text = f.lines[i];
        const trimmed = text.trimStart();
        if (/^(\/\/|\*|\/\*|#|--)/.test(trimmed)) continue;
        const m = new RegExp(re.source, flags).exec(opts.literals ? text : stripLiterals(text));
        if (!m) continue;
        if (this.isSuppressed(f, i + 1)) continue;
        out.push({ file: f.rel, line: i + 1, text: trimmed.slice(0, 200), match: m });
      }
    }
    return out;
  }

  /** True when the line (1-based) or the line above it carries a `preflight-ignore` comment. */
  isSuppressed(file: SourceFile | string, line: number): boolean {
    const f = typeof file === 'string' ? this.files.get(file) : file;
    if (!f) return false;
    return IGNORE_DIRECTIVE.test(f.lines[line - 1] ?? '') || IGNORE_DIRECTIVE.test(f.lines[line - 2] ?? '');
  }

  /** Files tracked by git matching the given pathspecs, or null if this isn't a git repo. */
  gitTracked(...pathspecs: string[]): string[] | null {
    try {
      const out = execFileSync('git', [...SAFE_GIT, 'ls-files', '--', ...pathspecs], {
        cwd: this.root,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return out.split('\n').map((s) => s.trim()).filter(Boolean);
    } catch {
      return null;
    }
  }

  /** Whether git would ignore the given path, or null if git is unavailable. */
  gitIgnores(rel: string): boolean | null {
    try {
      execFileSync('git', [...SAFE_GIT, 'check-ignore', '-q', '--no-index', rel], { cwd: this.root, stdio: 'ignore' });
      return true;
    } catch (err: any) {
      return err?.status === 1 ? false : null;
    }
  }
}
