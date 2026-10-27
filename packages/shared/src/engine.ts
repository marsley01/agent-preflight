import type {
  CheckResult,
  CheckStatus,
  CategoryResult,
  ScanReport,
  ProductionScore,
  ScanProgress,
  ScanStage,
  CategoryId,
} from './types';
import { ALL_CHECKS, CHECKS_BY_CATEGORY } from './checks/index';
import { calculateProductionScore, scoreCategory } from './scoring';
import { getClientFiles, runOtherDatabaseChecks, runUiChecks } from './ui-db-checks';

interface FileEntry {
  path: string;
  content: string | null;
  type: 'file' | 'dir';
}

interface ScanCtx {
  owner: string;
  repo: string;
  signal?: AbortSignal;
  token?: string;
  files: Map<string, string | null>;
  allFilePaths: string[];
  /** Fetched source files only (no docs, tests, vendored or built output) */
  codeFiles: string[];
  /** Concatenated content of codeFiles: use for code-pattern checks */
  codeJoined: string;
}

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const match = input.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  const parts = input.replace(/^@/, '').split('/');
  if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  return null;
}

async function fetchWithRetry(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, opts);
      // Only 5xx and 429 are worth retrying; other statuses are final.
      if (res.status < 500 && res.status !== 429) return res;
      if (i === retries) return res;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastError = err;
      if (i === retries) throw err;
    }
    await new Promise(r => setTimeout(r, 500 * 2 ** i));
  }
  throw lastError;
}

const MAX_FILE_BYTES = 500_000;
const MAX_FETCHED_FILES = 1500;
const LOCKFILE_RE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|npm-shrinkwrap\.json)$/;
const CODE_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const NON_SOURCE_RE = /(^|\/)(node_modules|dist|build|out|\.next|vendor|coverage|__tests__|__mocks__)\/|\.(test|spec)\.\w+$|\.d\.ts$|\.min\.(js|css)$/;

function isCodeFile(filePath: string): boolean {
  return CODE_FILE_RE.test(filePath) && !NON_SOURCE_RE.test(filePath);
}

function encodePath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

/** High-signal credential formats: matching the value, not the variable name. */
const SECRET_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /AKIA[0-9A-Z]{16}/, label: 'AWS access key' },
  { regex: /gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}/, label: 'GitHub token' },
  { regex: /[sr]k_live_[A-Za-z0-9]{20,}/, label: 'Stripe live secret key' },
  { regex: /sk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{32,}/, label: 'Anthropic API key' },
  { regex: /sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}|\bsk-[A-Za-z0-9]{48}\b|sk-[A-Za-z0-9]{20}T3BlbkFJ/, label: 'OpenAI API key' },
  { regex: /AIza[0-9A-Za-z_-]{35}/, label: 'Google API key' },
  { regex: /xox[baprs]-[A-Za-z0-9-]{10,}/, label: 'Slack token' },
  { regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/, label: 'Private key' },
  { regex: /service_role[^\n]{0,40}eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/, label: 'Supabase service_role JWT' },
];

const PUBLIC_SECRET_ENV_RE = /\b(?:NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_)\w*(?:SECRET|SERVICE_ROLE|PRIVATE)\w*/;

function looksLikePlaceholder(line: string): boolean {
  return /xxx|your_|your-|example|<[^>]*>|\.\.\./i.test(line);
}

function redact(line: string, secret: string): string {
  return line.replace(secret, `${secret.slice(0, 4)}****`);
}

/** A real env file that should never be committed (templates are fine). */
function isRealEnvFile(filePath: string): boolean {
  return /(^|\/)\.env(\.(local|development|production|staging|test)(\.local)?)?$/.test(filePath);
}

/** Whether .gitignore contents actually ignore a root `.env` file. */
function ignoresDotEnv(gitignore: string): boolean {
  const lines = gitignore.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  // `.env.*` alone does not cover `.env` itself
  const ignored = lines.some(l => /^\/?(\*\*\/)?(\.env\*?|\*\.env\*?|\*)$/.test(l));
  const negated = lines.some(l => /^!\/?\.env$/.test(l));
  return ignored && !negated;
}

/** Whether the repo actually calls an LLM provider SDK. */
function usesLlmSdk(ctx: ScanCtx): boolean {
  const sdkRe = /^(openai|@anthropic-ai\/sdk|ai|@ai-sdk\/.+|langchain|@langchain\/.+|@google\/generative-ai|@google\/genai|groq-sdk|@mistralai\/.+|cohere-ai|ollama|llamaindex)$/;
  for (const p of ctx.allFilePaths.filter(f => f === 'package.json' || f.endsWith('/package.json'))) {
    const content = ctx.files.get(p);
    if (!content) continue;
    try {
      const pkg = JSON.parse(content);
      if (Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some(d => sdkRe.test(d))) return true;
    } catch {}
  }
  return /from\s+['"](openai|@anthropic-ai\/sdk|ai|@ai-sdk\/[\w-]+|langchain[\w/-]*|@langchain\/[\w-]+|@google\/generative-ai|@google\/genai|groq-sdk|ollama|llamaindex)['"]/.test(ctx.codeJoined);
}

async function loadRepository(
  owner: string,
  repo: string,
  signal?: AbortSignal,
  token?: string,
): Promise<{ files: Map<string, string | null>; paths: string[]; info: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // 1. Get repo info + default branch
  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const repoRes = await fetchWithRetry(repoUrl, { headers, signal });
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error(`Repository ${owner}/${repo} not found or is private`);
    if (repoRes.status === 403 || repoRes.status === 429) throw new Error('GitHub API rate limit reached');
    throw new Error(`Failed to fetch repository: ${repoRes.statusText}`);
  }
  const repoInfo = await repoRes.json();
  const defaultBranch = repoInfo.default_branch || 'main';

  // 2. Get full file tree in ONE API call via Git Trees API
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;
  const treeRes = await fetchWithRetry(treeUrl, { headers, signal });
  if (!treeRes.ok) throw new Error('Failed to fetch repository tree');

  const treeData = await treeRes.json();
  const paths: string[] = [];
  const relevantPaths: string[] = [];

  if (treeData.tree) {
    for (const item of treeData.tree) {
      if (item.type === 'blob') {
        paths.push(item.path);
        // Lockfiles only matter for presence; their content is huge
        if (LOCKFILE_RE.test(item.path)) continue;
        if (typeof item.size === 'number' && item.size > MAX_FILE_BYTES) continue;
        if (/(^|\/)node_modules\//.test(item.path)) continue;
        // Pre-filter to relevant files only: skip binaries, large files, .git
        if (
          /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|json|env|yml|yaml|css|scss|sass|less|html|md|sql|prisma|toml|rules)$/.test(item.path) ||
          /\.(config\.(ts|js|mjs)|eslintrc|prettierrc)$/.test(item.path) ||
          /(^|\/)\.env(\.[\w-]+)?$/.test(item.path) ||
          ['Dockerfile', 'docker-compose.yml', '.gitignore', '.env.example', 'Makefile', 'nginx.conf', '.htaccess', 'web.config', 'package.json'].some(n => item.path === n || item.path.endsWith('/' + n))
        ) {
          relevantPaths.push(item.path);
        }
      }
    }
  }

  // Root-level files first so config checks still work when the cap kicks in
  relevantPaths.sort((a, b) => a.split('/').length - b.split('/').length);
  const truncated = Boolean(treeData.truncated) || relevantPaths.length > MAX_FETCHED_FILES;
  relevantPaths.length = Math.min(relevantPaths.length, MAX_FETCHED_FILES);

  const files = new Map<string, string | null>();

  // 3. Fetch file contents in parallel: HIGH concurrency (25)
  const MAX_CONCURRENCY = 25;
  let pending = 0;
  const queue: (() => void)[] = [];

  async function acquire(): Promise<void> {
    if (pending < MAX_CONCURRENCY) { pending++; return; }
    await new Promise<void>(resolve => queue.push(() => { pending++; resolve(); }));
  }

  function release(): void {
    pending--;
    const next = queue.shift();
    next?.();
  }

  await Promise.all(relevantPaths.map(async (filePath) => {
    if (signal?.aborted) return;
    await acquire();
    try {
      // Unauthenticated: raw.githubusercontent.com doesn't count against the 60 req/hr API quota.
      // Authenticated: the contents API (5000 req/hr) also works for private repos.
      const res = token
        ? await fetchWithRetry(
            `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(defaultBranch)}`,
            { headers: { ...headers, Accept: 'application/vnd.github.raw' }, signal },
          )
        : await fetchWithRetry(
            `https://raw.githubusercontent.com/${owner}/${repo}/${encodePath(defaultBranch)}/${encodePath(filePath)}`,
            { signal },
          );
      if (res.ok) {
        files.set(filePath, await res.text());
      }
    } catch {
      // skip failed file fetches
    } finally {
      release();
    }
  }));

  return { files, paths, info: { ...repoInfo, truncated } };
}

/** First line in a source file matching `pattern`, skipping comment lines. */
function findInCode(ctx: ScanCtx, pattern: RegExp): { file: string; line: number; snippet: string } | null {
  for (const filePath of ctx.codeFiles) {
    const content = ctx.files.get(filePath);
    if (!content) continue;
    const hit = checkLines(content, l => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && pattern.test(l);
    });
    if (hit.found) return { file: filePath, line: hit.lineIndex + 1, snippet: content.split('\n')[hit.lineIndex].trim() };
  }
  return null;
}

/** Code + config + markup, but not docs: a README that mentions HSTS doesn't configure it. */
function nonDocJoined(ctx: ScanCtx): string {
  return [...ctx.files.entries()]
    .filter(([p, c]) => c && !/\.(md|mdx|txt)$/i.test(p) && !NON_SOURCE_RE.test(p))
    .map(([, c]) => c)
    .join('\n');
}

function checkPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(content));
}

function checkLines(content: string, predicate: (line: string, lineIndex: number) => boolean): { found: boolean; lineIndex: number } {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i], i)) return { found: true, lineIndex: i };
  }
  return { found: false, lineIndex: -1 };
}

function findLine(content: string, pattern: RegExp | string): { found: boolean; line: number; lineContent?: string } {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (typeof pattern === 'string') {
      if (lines[i].includes(pattern)) return { found: true, line: i + 1, lineContent: lines[i].trim() };
    } else {
      if (pattern.test(lines[i])) return { found: true, line: i + 1, lineContent: lines[i].trim() };
    }
  }
  return { found: false, line: -1 };
}

function generateAiFixPrompt(check: CheckResult, def: typeof ALL_CHECKS[0]): string {
  return `Fix the following issue in your codebase:

Issue: ${def.title}
Description: ${def.description}
Risk: ${def.risk}
${check.file ? `File: ${check.file}${check.line ? `:${check.line}` : ''}` : ''}

Suggested fix: ${check.suggestedFix || def.suggestedFix}

${check.snippet ? `Current code:\n\`\`\`\n${check.snippet}\n\`\`\`` : ''}

Apply the fix while maintaining code quality and consistency with the existing codebase.`;
}

async function runSecurityCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const gitignore = ctx.files.get('.gitignore');
  if (gitignore) {
    if (ignoresDotEnv(gitignore)) {
      results.push({ checkId: 'security-secrets-env-gitignored', status: 'pass', message: '.env is gitignored' });
    } else {
      results.push({ checkId: 'security-secrets-env-gitignored', status: 'fail', message: '.env is NOT gitignored: secrets will be committed', suggestedFix: 'Add .env to your .gitignore file' });
    }
  } else {
    results.push({ checkId: 'security-secrets-env-gitignored', status: 'warn', message: 'No .gitignore found' });
  }

  const committedEnv = ctx.allFilePaths.filter(isRealEnvFile);
  results.push(committedEnv.length > 0
    ? {
        checkId: 'security-committed-env-file',
        status: 'fail',
        message: `Environment file committed to the repository: ${committedEnv.slice(0, 3).join(', ')}`,
        file: committedEnv[0],
        suggestedFix: 'Remove the file with `git rm --cached`, add it to .gitignore, and rotate every secret it contained.',
      }
    : { checkId: 'security-committed-env-file', status: 'pass', message: 'No .env files committed' });

  const envExample = ctx.files.get('.env.example');
  if (envExample) {
    results.push({ checkId: 'security-secrets-env-example', status: 'pass', message: '.env.example exists' });
    const hasAuthSecret = /JWT_SECRET|NEXTAUTH_SECRET|AUTH_SECRET/.test(envExample);
    results.push({
      checkId: 'security-auth-secret',
      status: hasAuthSecret ? 'pass' : 'warn',
      message: hasAuthSecret ? 'Auth secret documented in .env.example' : 'No JWT_SECRET or NEXTAUTH_SECRET in .env.example',
    });
  } else {
    results.push({ checkId: 'security-secrets-env-example', status: 'warn', message: 'No .env.example: collaborators won\'t know what vars to set' });
    results.push({ checkId: 'security-auth-secret', status: 'warn', message: 'No .env.example: cannot verify auth secret documentation' });
  }

  // Hardcoded secret values, across code and config files (not docs or tests)
  const secretScanFiles = [...ctx.files.keys()].filter(f =>
    !NON_SOURCE_RE.test(f) && !/\.(md|lock)$/.test(f) && !/(^|\/)\.env\.(example|sample|template)$/.test(f)
  );
  let foundSecret = false;
  for (const filePath of secretScanFiles) {
    const content = ctx.files.get(filePath);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { regex, label } of SECRET_PATTERNS) {
        const match = lines[i].match(regex);
        if (!match || looksLikePlaceholder(lines[i])) continue;
        results.push({
          checkId: 'security-hardcoded-secrets',
          status: 'fail',
          message: `${label} hardcoded in source`,
          file: filePath,
          line: i + 1,
          snippet: redact(lines[i].trim(), match[0]),
          suggestedFix: 'Rotate this credential now, then load it from a server-only environment variable.',
        });
        foundSecret = true;
        break;
      }
    }
  }
  if (!foundSecret) {
    results.push({ checkId: 'security-hardcoded-secrets', status: 'pass', message: 'No hardcoded API keys or private keys found' });
  }

  // Secrets behind a client-exposed env prefix get inlined into the browser bundle
  let foundPublicSecret = false;
  for (const filePath of [...ctx.codeFiles, ...ctx.allFilePaths.filter(f => /(^|\/)\.env(\.[\w-]+)?$/.test(f))]) {
    const content = ctx.files.get(filePath);
    if (!content) continue;
    const found = findLine(content, PUBLIC_SECRET_ENV_RE);
    if (found.found) {
      results.push({
        checkId: 'security-secrets-client-exposure',
        status: 'fail',
        message: `Secret exposed through a public env prefix (${found.lineContent?.match(PUBLIC_SECRET_ENV_RE)?.[0]})`,
        file: filePath,
        line: found.line,
        snippet: found.lineContent,
      });
      foundPublicSecret = true;
    }
  }
  if (!foundPublicSecret) {
    results.push({ checkId: 'security-secrets-client-exposure', status: 'pass', message: 'No secrets behind NEXT_PUBLIC_/VITE_ style public env vars' });
  }

  // Next.js 16 renamed middleware.ts to proxy.ts
  const hasMiddleware = ctx.allFilePaths.some(p => /^(src\/)?(middleware|proxy)\.(ts|js|mjs)$/.test(p));
  results.push({
    checkId: 'security-auth-middleware',
    status: hasMiddleware ? 'pass' : 'warn',
    message: hasMiddleware ? 'Auth middleware file found' : 'No middleware.ts / proxy.ts found: protected routes may be unsecured',
  });

  const allContentJoined = nonDocJoined(ctx);

  const hasCsrf = /csrf|CSRF|csrfToken|SameSite|sameSite|same-site|xsrf|XSRF/.test(allContentJoined);
  results.push({
    checkId: 'security-csrf-protection',
    status: hasCsrf ? 'pass' : 'warn',
    message: hasCsrf ? 'CSRF protection detected' : 'No CSRF protection detected: forms and API mutations may be vulnerable',
  });

  const hasRateLimit = /ratelimit|rate-limit|upstash.*ratelimit|express-rate-limit/.test(allContentJoined);
  results.push({
    checkId: 'security-rate-limiting',
    status: hasRateLimit ? 'pass' : 'warn',
    message: hasRateLimit ? 'Rate limiting detected' : 'No rate limiting found: API may be open to abuse',
  });

  const configContent = ['next.config.ts', 'next.config.js', 'next.config.mjs', '.env', 'vite.config.ts']
    .map(p => ctx.files.get(p))
    .filter(Boolean)
    .join('\n');

  const hasCsp = /Content-Security-Policy|contentSecurityPolicy|\.csp\b/.test(configContent);
  results.push({
    checkId: 'security-csp-configured',
    status: hasCsp ? 'pass' : 'warn',
    message: hasCsp ? 'Content Security Policy (CSP) configured' : 'No CSP found: app may be vulnerable to XSS',
  });

  const hasHsts = /Strict-Transport-Security|HSTS/.test(allContentJoined);
  results.push({
    checkId: 'security-hsts',
    status: hasHsts ? 'pass' : 'warn',
    message: hasHsts ? 'HSTS configured' : 'No HSTS header found: users may connect over HTTP',
  });

  const hasNosniff = /nosniff|X-Content-Type-Options/.test(allContentJoined);
  results.push({
    checkId: 'security-nosniff',
    status: hasNosniff ? 'pass' : 'warn',
    message: hasNosniff ? 'X-Content-Type-Options: nosniff found' : 'No X-Content-Type-Options: nosniff found',
  });

  const hasCors = /Access-Control-Allow-Origin|cors\(|cors\s*\{/.test(allContentJoined);
  results.push({
    checkId: 'security-cors-configured',
    status: hasCors ? 'pass' : 'warn',
    message: hasCors ? 'CORS configuration found' : 'No CORS configuration found',
  });

  const hasClickjack = /X-Frame-Options|frame-ancestors/.test(allContentJoined);
  results.push({
    checkId: 'security-clickjacking',
    status: hasClickjack ? 'pass' : 'warn',
    message: hasClickjack ? 'Clickjacking protection found' : 'No clickjacking protection found',
  });

  const hasCookieSecurity = /httpOnly|secure.*cookie|cookie.*secure|SameSite/.test(allContentJoined);
  results.push({
    checkId: 'security-cookie-security',
    status: hasCookieSecurity ? 'pass' : 'warn',
    message: hasCookieSecurity ? 'Cookie security flags detected' : 'No cookie security flags detected',
  });

  const xss = findInCode(ctx, /dangerouslySetInnerHTML|\.(innerHTML|outerHTML)\s*=[^=]|document\.write\(/);
  results.push(xss
    ? { checkId: 'security-xss-protection', status: 'warn', message: 'dangerouslySetInnerHTML or innerHTML assignment found: potential XSS risk', ...xss }
    : { checkId: 'security-xss-protection', status: 'pass', message: 'No dangerous HTML assignments found' });

  const evalHit = findInCode(ctx, /(?<![\w.$])eval\s*\(|\bnew\s+Function\s*\(/);
  results.push(evalHit
    ? { checkId: 'security-eval-usage', status: 'fail', message: 'eval() or new Function() detected: arbitrary code execution risk', ...evalHit }
    : { checkId: 'security-eval-usage', status: 'pass', message: 'No eval() or new Function() usage detected' });

  const hasXfo = /X-Frame-Options:\s*DENY/.test(allContentJoined);
  results.push({
    checkId: 'security-x-frame-options',
    status: hasXfo ? 'pass' : 'warn',
    message: hasXfo ? 'X-Frame-Options: DENY configured' : 'No X-Frame-Options: DENY found',
  });

  const hasOauth = /OAuth|oauth|passport|next-auth|nextauth|auth\.js/.test(allContentJoined);
  // Auth libraries handle state/PKCE themselves; hand-rolled flows must do it explicitly
  const hasOauthState = /PKCE|pkce|code_verifier|codeVerifier|next-auth|nextauth|@auth\/|better-auth|@clerk\/|@supabase\/(ssr|auth-helpers)|oauth_state|oauthState/.test(allContentJoined);
  if (hasOauth) {
    results.push({
      checkId: 'security-oauth-configured',
      status: hasOauthState ? 'pass' : 'warn',
      message: hasOauthState ? 'OAuth with state/PKCE detected' : 'OAuth detected but state/PKCE not verified',
    });
  }

  const hasInputValidation = /z\.object|yup\.object|v\.object|\.safeParse\(|\.parse\(|\.validate\(/.test(ctx.codeJoined);
  const hasApiRoutes = ctx.allFilePaths.some(f => /^(src\/)?(app\/api|pages\/api)\//.test(f));
  if (hasApiRoutes) {
    results.push({
      checkId: 'security-input-validation',
      status: hasInputValidation ? 'pass' : 'warn',
      message: hasInputValidation ? 'Input validation (Zod/Yup) detected on API routes' : 'No input validation found on API routes',
    });
  }

  const hasPackageLock = ctx.allFilePaths.some(f => LOCKFILE_RE.test(f));
  results.push({
    checkId: 'security-dependency-vulnerabilities',
    status: hasPackageLock ? 'info' : 'warn',
    message: hasPackageLock ? 'Lock file found: run npm audit for vulnerability scan' : 'No lock file found: dependencies may be vulnerable',
  });

  const debug = findInCode(ctx, /\b(debug|isDebug)\s*[:=]\s*true\b/);
  results.push(debug
    ? { checkId: 'security-debug-mode', status: 'warn', message: 'Debug mode enabled in source', ...debug }
    : { checkId: 'security-debug-mode', status: 'pass', message: 'No debug mode flags detected' });

  const gitignoreContent = ctx.files.get('.gitignore');
  if (gitignoreContent) {
    const expected = ['.next', 'dist', 'build', '.env.local', 'coverage', '.turbo'];
    const missing = expected.filter(e => !gitignoreContent!.includes(e));
    results.push({
      checkId: 'security-gitignore-hygiene',
      status: missing.length === 0 ? 'pass' : 'warn',
      message: missing.length === 0 ? 'All common build artifacts are gitignored' : `Build artifacts not gitignored: ${missing.join(', ')}`,
    });
  }

  // --- Supabase-specific checks ---
  const hasSupabase = /@supabase\/|supabase/i.test(ctx.codeJoined) || ctx.allFilePaths.some(f => f.startsWith('supabase/'));

  // RLS only matters when clients reach the database directly (Supabase / PostgREST). Apps that only
  // connect from the server (Drizzle, Prisma, pg) are protected by their own API layer.
  const hasSqlFiles = ctx.allFilePaths.some(f => f.endsWith('.sql'));
  const hasRls = /row level security|enable rls|CREATE POLICY/i.test(allContentJoined);
  results.push({
    checkId: 'security-rls-enabled',
    status: hasSqlFiles && hasRls ? 'pass' : (hasSqlFiles ? (hasSupabase ? 'fail' : 'info') : 'warn'),
    message: hasSqlFiles && hasRls ? 'Row Level Security enabled in migrations' :
      hasSqlFiles
        ? (hasSupabase ? 'No RLS policies found in SQL migrations' : 'No RLS in SQL migrations: fine while only your server connects to the database')
        : 'No SQL migrations found',
  });
  const sqlContent = ctx.allFilePaths
    .filter(f => f.endsWith('.sql'))
    .map(f => ctx.files.get(f))
    .filter(Boolean)
    .join('\n');

  // 1. Supabase service_role key referenced from code that ships to the browser
  const clientFiles = getClientFiles(ctx);
  let foundServiceKey = false;
  for (const filePath of clientFiles) {
    const content = ctx.files.get(filePath);
    if (!content) continue;
    const hit = checkLines(content, l => /service_role/i.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    if (hit.found) {
      results.push({
        checkId: 'security-supabase-service-key-exposure',
        status: 'fail',
        message: 'Supabase service_role key referenced in client-side code: full database access exposed',
        file: filePath,
        line: hit.lineIndex + 1,
        snippet: content.split('\n')[hit.lineIndex].trim(),
      });
      foundServiceKey = true;
    }
  }
  if (!foundServiceKey && hasSupabase) {
    results.push({
      checkId: 'security-supabase-service-key-exposure',
      status: 'pass',
      message: 'No Supabase service_role key detected in client-side code',
    });
  }

  // 2. RLS policy completeness: UPDATE with WITH CHECK
  if (sqlContent) {
    const updatePolicies = sqlContent.match(/CREATE\s+POLICY.*FOR\s+UPDATE/gi);
    const withUpdateCheck = sqlContent.match(/CREATE\s+POLICY[\s\S]*?FOR\s+UPDATE[\s\S]*?WITH\s+CHECK/gi);
    const hasUpdatePolicies = updatePolicies && updatePolicies.length > 0;
    const hasWithCheck = withUpdateCheck && withUpdateCheck.length > 0;

    if (hasUpdatePolicies) {
      results.push({
        checkId: 'security-supabase-rls-policy-completeness',
        status: hasWithCheck ? 'pass' : 'fail',
        message: hasWithCheck
          ? 'UPDATE policies include WITH CHECK clauses'
          : 'UPDATE policies missing WITH CHECK: users can reassign row ownership',
      });
    } else if (hasRls) {
      results.push({
        checkId: 'security-supabase-rls-policy-completeness',
        status: 'info',
        message: 'No UPDATE policies found: verify DELETE policies have WITH CHECK if applicable',
      });
    }
  }

  // 3. auth.role() deprecated usage
  const hasAuthRoleDeprecated = /auth\.role\s*\(/.test(sqlContent);
  if (hasSupabase) {
    results.push({
      checkId: 'security-supabase-auth-role-deprecated',
      status: hasAuthRoleDeprecated ? 'fail' : 'pass',
      message: hasAuthRoleDeprecated
        ? 'auth.role() detected: this is deprecated and breaks with anonymous sign-ins'
        : 'auth.role() not detected: USING TO clause instead',
    });
  }

  // 4. View security_invoker
  if (sqlContent) {
    const hasViews = /CREATE\s+(OR\s+REPLACE\s+)?VIEW/i.test(sqlContent);
    const hasSecurityInvoker = /security_invoker\s*=\s*true/i.test(sqlContent);
    if (hasViews) {
      results.push({
        checkId: 'security-supabase-view-security-invoker',
        status: hasSecurityInvoker ? 'pass' : 'fail',
        message: hasSecurityInvoker
          ? 'Views use WITH (security_invoker = true)'
          : 'Views found without security_invoker: they bypass RLS by default',
      });
    }
  }

  // 5. Storage RLS
  if (hasSupabase) {
    // `storage` alone would match localStorage; look for Supabase Storage specifically
    const hasStorage = /\.storage\s*\.from\(|storage\.buckets|storage\.objects/.test(allContentJoined);
    const hasStorageRls = /create\s+policy[^;]*on\s+storage\.objects/i.test(sqlContent);
    if (hasStorage) {
      results.push({
        checkId: 'security-supabase-storage-rls',
        status: hasStorageRls ? 'pass' : 'warn',
        message: hasStorageRls
          ? 'Storage bucket RLS policies detected'
          : 'Storage usage detected but no bucket-level RLS policies found',
      });
    }
  }

  // 6. Missing SELECT policy on RLS tables
  if (sqlContent && hasRls) {
    const createTableStatements = sqlContent.match(/CREATE\s+TABLE\s+\w+/gi) || [];
    const selectPolicies = sqlContent.match(/CREATE\s+POLICY[\s\S]*?FOR\s+SELECT/gi) || [];
    if (createTableStatements.length > selectPolicies.length) {
      results.push({
        checkId: 'security-supabase-missing-select-policy',
        status: 'warn',
        message: `${createTableStatements.length} tables, ${selectPolicies.length} SELECT policies: some tables may lack SELECT access after RLS enablement`,
      });
    } else if (createTableStatements.length > 0) {
      results.push({
        checkId: 'security-supabase-missing-select-policy',
        status: 'pass',
        message: 'SELECT policies found for all detected tables',
      });
    }
  }

  // --- Firebase, MongoDB, Prisma, Convex, PocketBase, Appwrite, server drivers ---
  results.push(...runOtherDatabaseChecks(ctx));

  return results;
}

async function runAiSafetyCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Don't penalize repos that never call an LLM
  if (!usesLlmSdk(ctx)) {
    results.push({ checkId: 'ai-not-detected', status: 'info', message: 'No LLM SDK usage detected: AI safety checks skipped' });
    return results;
  }

  const code = ctx.codeJoined;

  // `instructions:` is the AI SDK 7 / OpenAI Responses name for the system prompt
  const hasSystemRole = /role:\s*['"](system|developer)['"]|\b(system|instructions):\s*[`'"\w]|systemInstruction|system_instruction/.test(code);
  results.push({
    checkId: 'ai-prompt-injection',
    status: hasSystemRole ? 'pass' : 'warn',
    message: hasSystemRole ? 'System prompt is passed separately from user messages' : 'No dedicated system prompt found: user input may be mixed into instructions',
  });

  const fetchesExternal = /\bfetch\(|axios\.(get|post)|cheerio|puppeteer|playwright|loadDocuments|WebBaseLoader/.test(code);
  if (fetchesExternal) {
    const hasSanitization = /sanitize|DOMPurify|stripHtml|escapeHtml|sanitize-html/i.test(code);
    results.push({
      checkId: 'ai-indirect-prompt-injection',
      status: hasSanitization ? 'pass' : 'warn',
      message: hasSanitization ? 'External content sanitization detected' : 'External content fetched but no sanitization found',
    });
  }

  const hasJailbreakDetect = /jailbreak|moderations?\.create|guardrail|lakera|llama-?guard|prompt-?guard/i.test(code);
  results.push({
    checkId: 'ai-jailbreak-resistance',
    status: hasJailbreakDetect ? 'pass' : 'info',
    message: hasJailbreakDetect ? 'Jailbreak/guardrail checks found' : 'No jailbreak resistance mechanisms detected',
  });

  const usesTools = /\btools:\s*[[{]|tool_choice|toolChoice|\btool\(\{|function_declarations|bindTools\(/.test(code);
  if (usesTools) {
    const hasToolGating = /needsApproval|requireApproval|allowedTools|toolPermissions|humanInTheLoop|confirm(ation)?Required/i.test(code);
    results.push({
      checkId: 'ai-tool-permissions',
      status: hasToolGating ? 'pass' : 'warn',
      message: hasToolGating ? 'Tool calls are gated by approvals or an allowlist' : 'LLM tools are enabled with no approval or allowlist: the model can call them freely',
    });
    results.push({
      checkId: 'ai-function-schema-validation',
      status: /inputSchema|parameters:\s*z\.|zodSchema|jsonSchema\(/.test(code) ? 'pass' : 'warn',
      message: /inputSchema|parameters:\s*z\.|zodSchema|jsonSchema\(/.test(code) ? 'Tool inputs are schema-validated' : 'Tool definitions found without input schemas',
    });
  }

  const hasVectorDb = /pinecone|weaviate|qdrant|chromadb|pgvector|vectorstore|VectorStore|\.similaritySearch\(|embeddings?\.create/i.test(code);
  if (hasVectorDb) {
    const hasMemoryValidation = /sanitize|safeParse|moderations?\.create/i.test(code);
    results.push({
      checkId: 'ai-memory-poisoning',
      status: hasMemoryValidation ? 'pass' : 'warn',
      message: hasMemoryValidation ? 'Content is validated before it reaches memory/vector storage' : 'Memory/vector storage found but no input validation',
    });

    const hasRagThreshold = /scoreThreshold|similarityThreshold|similarity_threshold|minScore|min_score|match_threshold/i.test(code);
    results.push({
      checkId: 'ai-rag-validation',
      status: hasRagThreshold ? 'pass' : 'warn',
      message: hasRagThreshold ? 'RAG retrieval uses a relevance threshold' : 'RAG retrieval has no relevance threshold: low-quality matches reach the prompt',
    });

    const hasTenantScoping = /namespace|tenant|filter:\s*\{[^}]*(user|org|tenant)/i.test(code);
    results.push({
      checkId: 'ai-vector-poisoning',
      status: hasTenantScoping ? 'pass' : 'info',
      message: hasTenantScoping ? 'Vector queries are scoped by namespace/tenant' : 'Vector queries are not visibly scoped per user or tenant',
    });
  }

  const hasHallucinationGuard = /citation|grounding|groundedness|sources?:\s*\[/i.test(code);
  results.push({
    checkId: 'ai-hallucination-mitigation',
    status: hasHallucinationGuard ? 'pass' : 'info',
    message: hasHallucinationGuard ? 'Grounding/citation patterns found' : 'No hallucination mitigation mechanisms detected',
  });

  const hasPiiMasking = /\bPII\b|redact|deidentify|presidio|mask(Email|Phone|Pii)/i.test(code);
  results.push({
    checkId: 'ai-pii-masking',
    status: hasPiiMasking ? 'pass' : 'warn',
    message: hasPiiMasking ? 'PII masking/redaction detected' : 'No PII masking detected: sensitive user data may be exposed to AI providers',
  });

  const hasOutputModeration = /moderations?\.create|moderation|guardrail|content.?filter/i.test(code);
  results.push({
    checkId: 'ai-output-moderation',
    status: hasOutputModeration ? 'pass' : 'info',
    message: hasOutputModeration ? 'Output moderation detected' : 'No AI output moderation detected',
  });

  const hasPromptLocking = /system_prompt|systemPrompt|SYSTEM_PROMPT|PromptTemplate|<user_input>|<\/?user>/.test(code);
  results.push({
    checkId: 'ai-prompt-locking',
    status: hasPromptLocking ? 'pass' : 'warn',
    message: hasPromptLocking ? 'Prompt template with system/user separation detected' : 'No prompt locking mechanism detected',
  });

  const hasStructuredOutput = /response_format|json_object|json_schema|generateObject|streamObject|withStructuredOutput|Output\.object|responseMimeType/.test(code);
  results.push({
    checkId: 'ai-json-enforcement',
    status: hasStructuredOutput ? 'pass' : 'info',
    message: hasStructuredOutput ? 'Structured output (JSON mode) detected' : 'No structured output enforcement detected',
  });

  const latestModel = findInCode(ctx, /['"][\w./-]*-latest['"]/);
  results.push(latestModel
    ? { checkId: 'ai-model-pinning', status: 'warn', message: 'Model referenced by a "-latest" alias: behavior can change under you', ...latestModel }
    : { checkId: 'ai-model-pinning', status: 'pass', message: 'No floating "-latest" model aliases found' });

  const hasTempConfig = /\btemperature\s*:/.test(code);
  results.push({
    checkId: 'ai-temperature-validation',
    status: hasTempConfig ? 'pass' : 'info',
    message: hasTempConfig ? 'Temperature configuration found' : 'No explicit temperature configuration detected',
  });

  const hasTokenLimits = /max_tokens|maxTokens|maxOutputTokens|max_completion_tokens|maxCompletionTokens/.test(code);
  results.push({
    checkId: 'ai-token-limits',
    status: hasTokenLimits ? 'pass' : 'warn',
    message: hasTokenLimits ? 'Token limits configured' : 'No token limits found: unbounded usage may cause cost overruns',
  });

  return results;
}

async function runRuntimeCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allJoined = nonDocJoined(ctx);

  const hasPackageJson = ctx.files.get('package.json');
  let hasRetry = false;
  let hasTimeout = false;
  let hasAbort = false;

  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(hasPackageJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      hasRetry = /retry|p-retry|async-retry/.test(JSON.stringify(deps));
      hasTimeout = /timeout|p-timeout|node-fetch|ky|got/.test(JSON.stringify(deps));
    } catch {}
  }

  hasRetry = hasRetry || /retry|backoff|\.catch\(|try.*catch/.test(allJoined);
  results.push({
    checkId: 'runtime-retry-logic',
    status: hasRetry ? 'pass' : 'warn',
    message: hasRetry ? 'Retry logic patterns detected' : 'No retry logic detected: transient failures may cause errors',
  });

  hasTimeout = hasTimeout || /timeout|AbortSignal|signal:|abort/.test(allJoined);
  results.push({
    checkId: 'runtime-timeouts',
    status: hasTimeout ? 'pass' : 'warn',
    message: hasTimeout ? 'Timeout/abort patterns detected' : 'No request timeout configuration detected',
  });

  hasAbort = hasAbort || /AbortController|AbortSignal|signal|abort/.test(allJoined);
  results.push({
    checkId: 'runtime-abort-controllers',
    status: hasAbort ? 'pass' : 'info',
    message: hasAbort ? 'Abort controllers detected' : 'No AbortController usage detected',
  });

  const hasLoopProtection = /maxIterations|max_turns|maxSteps|iterationLimit|stopWhen|stepCountIs|isStepCount|recursionLimit/i.test(allJoined);
  results.push({
    checkId: 'runtime-infinite-loop',
    status: hasLoopProtection ? 'pass' : 'warn',
    message: hasLoopProtection ? 'Iteration limits detected' : 'No infinite loop protection found: AI generation loops may run unbounded',
  });

  const hasTokenBudget = /token.*budget|token.*limit|max_tokens|cost.*limit|spend.*limit/i.test(allJoined);
  results.push({
    checkId: 'runtime-token-budget',
    status: hasTokenBudget ? 'pass' : 'warn',
    message: hasTokenBudget ? 'Token budget tracking detected' : 'No token budget management detected',
  });

  const hasFallbackModel = /fallback|model.*backup|alternative.*model|provider.*failover/i.test(allJoined);
  results.push({
    checkId: 'runtime-fallback-models',
    status: hasFallbackModel ? 'pass' : 'info',
    message: hasFallbackModel ? 'Fallback models configured' : 'No fallback models detected',
  });

  const hasCircuitBreaker = /circuit.*breaker|breaker|bulkhead|failsafe/i.test(allJoined);
  results.push({
    checkId: 'runtime-circuit-breakers',
    status: hasCircuitBreaker ? 'pass' : 'info',
    message: hasCircuitBreaker ? 'Circuit breaker patterns detected' : 'No circuit breaker implementation detected',
  });

  const hasConcurrencyControl = /concurrency|semaphore|queue.*limit|maxConcurrent|pool/i.test(allJoined);
  results.push({
    checkId: 'runtime-concurrency-limits',
    status: hasConcurrencyControl ? 'pass' : 'warn',
    message: hasConcurrencyControl ? 'Concurrency limits detected' : 'No concurrency limits detected',
  });

  return results;
}

async function runInfrastructureCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allJoined = nonDocJoined(ctx);

  const hasDockerfile = ctx.allFilePaths.some(f => f.includes('Dockerfile') || f === 'docker-compose.yml' || f === 'docker-compose.yaml');
  results.push({
    checkId: 'infra-dockerfile',
    status: hasDockerfile ? 'pass' : 'info',
    message: hasDockerfile ? 'Dockerfile found' : 'No Dockerfile found: container configuration recommended for production',
  });

  const hasHealthCheck = /\/health|\/ready|healthCheck|health_check|liveness|readiness/i.test(allJoined);
  results.push({
    checkId: 'infra-health-checks',
    status: hasHealthCheck ? 'pass' : 'warn',
    message: hasHealthCheck ? 'Health check endpoints detected' : 'No health check endpoints found',
  });

  const hasCdn = /cdn|cloudflare|fastly|cloudfront|akamai|vercel.*edge/i.test(allJoined);
  results.push({
    checkId: 'infra-cdn-configured',
    status: hasCdn ? 'pass' : 'info',
    message: hasCdn ? 'CDN configuration detected' : 'No CDN configuration detected',
  });

  const hasCacheControl = /Cache-Control|cache-control|ETag|etag|stale-while-revalidate/i.test(allJoined);
  results.push({
    checkId: 'infra-caching',
    status: hasCacheControl ? 'pass' : 'warn',
    message: hasCacheControl ? 'Cache headers detected' : 'No caching strategy detected',
  });

  const hasCompression = /gzip|brotli|compression|compress/i.test(allJoined);
  results.push({
    checkId: 'infra-compression',
    status: hasCompression ? 'pass' : 'info',
    message: hasCompression ? 'Compression configured' : 'No compression configuration detected',
  });

  const hasEnv = ctx.files.has('.env.example') || ctx.files.has('.env');
  results.push({
    checkId: 'infra-env-vars',
    status: hasEnv ? 'pass' : 'warn',
    message: hasEnv ? 'Environment variables documented' : 'No environment variable documentation found',
  });

  const hasRollback = /rollback|previous.*version|deploy.*history|release.*version/i.test(allJoined);
  results.push({
    checkId: 'infra-rollback',
    status: hasRollback ? 'pass' : 'info',
    message: hasRollback ? 'Rollback support detected' : 'No rollback configuration detected',
  });

  const hasBlueGreen = /blue.*green|green.*blue|canary|staging.*production/i.test(allJoined);
  results.push({
    checkId: 'infra-blue-green',
    status: hasBlueGreen ? 'pass' : 'info',
    message: hasBlueGreen ? 'Blue-green/canary deployment patterns found' : 'No blue-green deployment configuration detected',
  });

  return results;
}

async function runObservabilityCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allJoined = nonDocJoined(ctx);
  const hasPackageJson = ctx.files.get('package.json');

  let hasOtel = false;
  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(hasPackageJson);
      const deps = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies });
      hasOtel = /@opentelemetry|open-telemetry|opentelemetry/.test(deps);
    } catch {}
  }
  hasOtel = hasOtel || /@opentelemetry|OpenTelemetry|opentelemetry|OTEL/.test(allJoined);
  results.push({
    checkId: 'obs-opentelemetry',
    status: hasOtel ? 'pass' : 'info',
    message: hasOtel ? 'OpenTelemetry instrumentation detected' : 'No OpenTelemetry instrumentation found',
  });

  const hasStructuredLogs = /structured.*log|JSON.*log|logger\.info|logger\.error|pino|winston|bunyan/i.test(allJoined);
  results.push({
    checkId: 'obs-structured-logging',
    status: hasStructuredLogs ? 'pass' : 'warn',
    message: hasStructuredLogs ? 'Structured logging detected' : 'No structured logging found',
  });

  const hasAuditLogs = /audit.*log|auditLog|audit_trail|activity.*log/i.test(allJoined);
  results.push({
    checkId: 'obs-audit-logs',
    status: hasAuditLogs ? 'pass' : 'info',
    message: hasAuditLogs ? 'Audit logging detected' : 'No audit logging found',
  });

  const hasCostTracking = /cost.*track|token.*usage|usage.*track|spend.*monitor/i.test(allJoined);
  results.push({
    checkId: 'obs-cost-tracking',
    status: hasCostTracking ? 'pass' : 'info',
    message: hasCostTracking ? 'Cost tracking detected' : 'No AI cost tracking found',
  });

  const hasLatencyTracking = /latency|duration.*track|response.*time|p50|p95|p99/i.test(allJoined);
  results.push({
    checkId: 'obs-latency-tracking',
    status: hasLatencyTracking ? 'pass' : 'info',
    message: hasLatencyTracking ? 'Latency tracking detected' : 'No latency tracking detected',
  });

  const hasTracing = /tracing|trace|span|distributed.*trace/i.test(allJoined);
  results.push({
    checkId: 'obs-tracing',
    status: hasTracing ? 'pass' : 'info',
    message: hasTracing ? 'Distributed tracing detected' : 'No distributed tracing found',
  });

  const hasCorrelationIds = /correlation.*id|request.*id|trace.*id|x-request-id/i.test(allJoined);
  results.push({
    checkId: 'obs-correlation-ids',
    status: hasCorrelationIds ? 'pass' : 'info',
    message: hasCorrelationIds ? 'Correlation IDs detected' : 'No correlation IDs found',
  });

  return results;
}

async function runPerformanceCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allJoined = nonDocJoined(ctx);
  const hasPackageJson = ctx.files.get('package.json');

  let hasCodeSplitting = false;
  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(hasPackageJson);
      const deps = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies });
      hasCodeSplitting = /react.lazy|lazy\(\).*import|React\.lazy|dynamic.*import|loadable/.test(deps);
    } catch {}
  }
  hasCodeSplitting = hasCodeSplitting || /React\.lazy|lazy\(\)|dynamic\(\)|import\(/.test(allJoined);
  results.push({
    checkId: 'perf-code-splitting',
    status: hasCodeSplitting ? 'pass' : 'info',
    message: hasCodeSplitting ? 'Code splitting detected' : 'No code splitting detected: entire app may load at once',
  });

  const hasLazyLoading = /lazy|loading="lazy"|loading='lazy'|IntersectionObserver/i.test(allJoined);
  results.push({
    checkId: 'perf-lazy-loading',
    status: hasLazyLoading ? 'pass' : 'info',
    message: hasLazyLoading ? 'Lazy loading detected' : 'No lazy loading detected',
  });

  const hasImageOpt = /next\/image|Image|img.*loading|lazy|srcSet|sizes|webp|avif/i.test(allJoined);
  results.push({
    checkId: 'perf-image-optimization',
    status: hasImageOpt ? 'pass' : 'info',
    message: hasImageOpt ? 'Image optimization detected' : 'No image optimization detected',
  });

  const hasClsGuard = /aspect-ratio|width.*height|min-height|max-width.*100/.test(allJoined);
  results.push({
    checkId: 'perf-cls',
    status: hasClsGuard ? 'pass' : 'info',
    message: hasClsGuard ? 'Layout shift prevention detected' : 'No CLS prevention patterns detected',
  });

  return results;
}

async function runAccessibilityCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allJoined = nonDocJoined(ctx);

  const hasKeyboardSupport = /tabIndex|onKeyDown|onKeyPress|keyboard|focus/i.test(allJoined);
  results.push({
    checkId: 'a11y-keyboard-nav',
    status: hasKeyboardSupport ? 'pass' : 'info',
    message: hasKeyboardSupport ? 'Keyboard event handlers detected' : 'No keyboard navigation patterns detected',
  });

  const hasAria = /aria-label|aria-describedby|aria-hidden|role=|aria-labelledby|aria-expanded/i.test(allJoined);
  results.push({
    checkId: 'a11y-aria',
    status: hasAria ? 'pass' : 'warn',
    message: hasAria ? 'ARIA attributes detected' : 'No ARIA attributes found: screen reader support may be limited',
  });

  const hasResponsive = /@media|grid|flex|responsive|container|min-width|max-width|clamp\(|rem/i.test(allJoined);
  results.push({
    checkId: 'a11y-responsive',
    status: hasResponsive ? 'pass' : 'warn',
    message: hasResponsive ? 'Responsive design patterns detected' : 'No responsive design patterns detected',
  });

  const hasReducedMotion = /prefers-reduced-motion|reducedMotion/i.test(allJoined);
  results.push({
    checkId: 'a11y-reduced-motion',
    status: hasReducedMotion ? 'pass' : 'info',
    message: hasReducedMotion ? 'Reduced motion support detected' : 'No reduced motion support found',
  });

  return results;
}

async function runComplianceCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allJoined = nonDocJoined(ctx);

  const hasPrivacyPolicy = /privacy|privacy.*policy|data.*protection|cookie.*consent|cookieConsent/i.test(allJoined);
  results.push({
    checkId: 'comp-gdpr',
    status: hasPrivacyPolicy ? 'pass' : 'info',
    message: hasPrivacyPolicy ? 'Privacy/GDPR patterns detected' : 'No GDPR/privacy compliance patterns detected',
  });

  const hasDeleteAccount = /delete.*account|account.*deletion|DELETE.*user|remove.*account/i.test(allJoined);
  results.push({
    checkId: 'comp-delete-account',
    status: hasDeleteAccount ? 'pass' : 'info',
    message: hasDeleteAccount ? 'Account deletion capability detected' : 'No account deletion functionality detected',
  });

  const hasExportData = /export.*data|data.*export|download.*data|user.*data.*download/i.test(allJoined);
  results.push({
    checkId: 'comp-export-data',
    status: hasExportData ? 'pass' : 'info',
    message: hasExportData ? 'Data export capability detected' : 'No data export functionality detected',
  });

  return results;
}

const CATEGORY_RUNNERS: Record<string, (ctx: ScanCtx) => Promise<CheckResult[]>> = {
  security: runSecurityCheck,
  'ai-safety': runAiSafetyCheck,
  runtime: runRuntimeCheck,
  infrastructure: runInfrastructureCheck,
  observability: runObservabilityCheck,
  performance: runPerformanceCheck,
  accessibility: runAccessibilityCheck,
  compliance: runComplianceCheck,
  ui: async (ctx) => runUiChecks(ctx),
};

export async function scanGitHubRepo(
  input: string,
  signal?: AbortSignal,
  onProgress?: (progress: ScanProgress) => void,
  token?: string,
): Promise<ScanReport> {
  const startTime = Date.now();
  const parsed = parseGitHubUrl(input);
  if (!parsed) {
    return {
      id: crypto.randomUUID(),
      repoName: input,
      timestamp: startTime,
      duration: 0,
      status: 'error',
      error: `Could not parse "${input}" as a GitHub repository URL`,
      score: { overall: 0, maxOverall: 0, percentage: 0, categories: [] },
      categories: [],
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
    };
  }

  const { owner, repo } = parsed;
  const stages: ScanStage[] = ['repository-discovery', 'loading-dependencies', 'inspecting-configuration', 'analyzing-runtime', 'scanning-security', 'evaluating-ai-safety', 'checking-deployment', 'generating-report'];
  const totalStages = stages.length;
  let stageIndex = 0;

  function emitProgress(categoryProgress?: { categoryId: CategoryId; completed: number; total: number }[]) {
    onProgress?.({
      stage: stages[stageIndex] || 'generating-report',
      stageIndex,
      totalStages,
      categoryProgress: categoryProgress || [],
    });
  }

  emitProgress();

  let ctx: ScanCtx;
  try {
    const { files, paths, info } = await loadRepository(owner, repo, signal, token);
    stageIndex = 1;
    emitProgress();
    const codeFiles = [...files.keys()].filter(isCodeFile);
    const codeJoined = codeFiles.map(f => files.get(f) ?? '').join('\n');
    ctx = { owner, repo, signal, token, files, allFilePaths: paths, codeFiles, codeJoined };
  } catch (err: any) {
    return {
      id: crypto.randomUUID(),
      repoName: `${owner}/${repo}`,
      timestamp: startTime,
      duration: Date.now() - startTime,
      status: 'error',
      error: err.message || 'Failed to load repository',
      score: { overall: 0, maxOverall: 0, percentage: 0, categories: [] },
      categories: [],
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
    };
  }

  try {
    stageIndex = 2;
    emitProgress();
    stageIndex = 3;
    emitProgress();

    const engineRunners = [
      { cat: 'security' as const, label: 'Security', runner: CATEGORY_RUNNERS['security'] },
      { cat: 'ai-safety' as const, label: 'AI Safety', runner: CATEGORY_RUNNERS['ai-safety'] },
      { cat: 'runtime' as const, label: 'Runtime', runner: CATEGORY_RUNNERS['runtime'] },
      { cat: 'infrastructure' as const, label: 'Infrastructure', runner: CATEGORY_RUNNERS['infrastructure'] },
      { cat: 'observability' as const, label: 'Observability', runner: CATEGORY_RUNNERS['observability'] },
      { cat: 'performance' as const, label: 'Performance', runner: CATEGORY_RUNNERS['performance'] },
      { cat: 'accessibility' as const, label: 'Accessibility', runner: CATEGORY_RUNNERS['accessibility'] },
      { cat: 'compliance' as const, label: 'Compliance', runner: CATEGORY_RUNNERS['compliance'] },
      { cat: 'ui' as const, label: 'UI & Content', runner: CATEGORY_RUNNERS['ui'] },
    ];

    // Run all category checks in PARALLEL for max speed
    stageIndex = 4;
    emitProgress();

    const categoryResults: CategoryResult[] = await Promise.all(
      engineRunners.map(async ({ cat, label, runner }) => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const checks = await runner(ctx);
        const scored = scoreCategory(cat, checks);
        return {
          categoryId: cat,
          categoryLabel: label,
          checks,
          ...scored,
        };
      })
    );

    stageIndex = 7;
    emitProgress();

    const score = calculateProductionScore(categoryResults);
    const totalChecks = categoryResults.reduce((s, c) => s + c.total, 0);
    const passedChecks = categoryResults.reduce((s, c) => s + c.passed, 0);
    const failedChecks = categoryResults.reduce((s, c) => s + c.failed, 0);
    const warningChecks = categoryResults.reduce((s, c) => s + c.warned, 0);

    const report: ScanReport = {
      id: crypto.randomUUID(),
      repoName: `${owner}/${repo}`,
      repoUrl: `https://github.com/${owner}/${repo}`,
      timestamp: startTime,
      duration: Date.now() - startTime,
      status: 'complete',
      score,
      categories: categoryResults,
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
    };

    return report;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        id: crypto.randomUUID(),
        repoName: `${owner}/${repo}`,
        timestamp: startTime,
        duration: Date.now() - startTime,
        status: 'cancelled',
        score: { overall: 0, maxOverall: 0, percentage: 0, categories: [] },
        categories: [],
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warningChecks: 0,
      };
    }
    return {
      id: crypto.randomUUID(),
      repoName: `${owner}/${repo}`,
      timestamp: startTime,
      duration: Date.now() - startTime,
      status: 'error',
      error: err.message || 'Scan failed',
      score: { overall: 0, maxOverall: 0, percentage: 0, categories: [] },
      categories: [],
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningChecks: 0,
    };
  }
}
