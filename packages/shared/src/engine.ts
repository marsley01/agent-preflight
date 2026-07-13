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
}

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const match = input.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  const parts = input.replace(/^@/, '').split('/');
  if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  return null;
}

async function fetchWithRetry(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, opts);
    if (res.ok || res.status >= 400) return res;
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return fetch(url, opts);
}

async function loadRepository(
  owner: string,
  repo: string,
  signal?: AbortSignal,
  token?: string,
): Promise<{ files: Map<string, string | null>; paths: string[]; info: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const repoRes = await fetchWithRetry(repoUrl, { headers, signal });
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error(`Repository ${owner}/${repo} not found or is private`);
    if (repoRes.status === 403 || repoRes.status === 429) throw new Error('GitHub API rate limit reached');
    throw new Error(`Failed to fetch repository: ${repoRes.statusText}`);
  }
  const repoInfo = await repoRes.json();

  const files = new Map<string, string | null>();
  const paths: string[] = [];
  const maxConcurrency = 5;
  let pending = 0;
  const queue: (() => void)[] = [];

  async function acquire(): Promise<void> {
    if (pending < maxConcurrency) { pending++; return; }
    await new Promise<void>(resolve => queue.push(() => { pending++; resolve(); }));
  }

  function release(): void {
    pending--;
    const next = queue.shift();
    next?.();
  }

  async function listDir(dirPath: string): Promise<void> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`;
    await acquire();
    try {
      const res = await fetchWithRetry(url, { headers, signal });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) {
        if (data.type === 'file') {
          paths.push(data.path);
        }
        return;
      }
      const dirs: string[] = [];
      for (const item of data) {
        if (item.type === 'file') {
          paths.push(item.path);
        } else if (item.type === 'dir') {
          dirs.push(item.path);
        }
      }
      await Promise.all(dirs.map(d => listDir(d)));
    } finally {
      release();
    }
  }

  await listDir('');

  const fileReadQueue: string[] = paths.filter(p =>
    /\.(ts|tsx|js|jsx|json|env|yml|yaml|css|scss|html|md|sql|prisma|toml|lock|config\.(ts|js|mjs))$/.test(p) ||
    ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.gitignore', '.env.example', '.env', 'Makefile', 'Dockerfile', 'nginx.conf', '.htaccess', 'web.config', '.prettierrc', 'eslint.config.js', '.eslintrc.json'].some(n => p.endsWith(n) || p === n)
  );

  await Promise.all(fileReadQueue.map(async (filePath) => {
    if (signal?.aborted) return;
    await acquire();
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
      const res = await fetchWithRetry(url, { headers, signal });
      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          const content = atob(data.content.replace(/\n/g, ''));
          files.set(filePath, content);
        }
      }
    } finally {
      release();
    }
  }));

  return { files, paths, info: repoInfo };
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
  if (gitignore !== null) {
    if (gitignore!.includes('.env')) {
      results.push({ checkId: 'security-secrets-env-gitignored', status: 'pass', message: '.env is gitignored' });
    } else {
      results.push({ checkId: 'security-secrets-env-gitignored', status: 'fail', message: '.env is NOT gitignored — secrets will be committed', suggestedFix: 'Add .env to your .gitignore file' });
    }
  } else {
    results.push({ checkId: 'security-secrets-env-gitignored', status: 'warn', message: 'No .gitignore found' });
  }

  const envExample = ctx.files.get('.env.example');
  if (envExample !== null) {
    results.push({ checkId: 'security-secrets-env-example', status: 'pass', message: '.env.example exists' });
    const hasAuthSecret = /JWT_SECRET|NEXTAUTH_SECRET|AUTH_SECRET/.test(envExample!);
    results.push({
      checkId: 'security-auth-secret',
      status: hasAuthSecret ? 'pass' : 'warn',
      message: hasAuthSecret ? 'Auth secret documented in .env.example' : 'No JWT_SECRET or NEXTAUTH_SECRET in .env.example',
    });
  } else {
    results.push({ checkId: 'security-secrets-env-example', status: 'warn', message: 'No .env.example — collaborators won\'t know what vars to set' });
    results.push({ checkId: 'security-auth-secret', status: 'warn', message: 'No .env.example — cannot verify auth secret documentation' });
  }

  const clientExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const clientDirs = ['components/', 'app/', 'pages/', 'src/app/', 'src/pages/', 'src/components/', 'src/lib/'];
  const suspiciousFiles = ctx.allFilePaths.filter(f =>
    clientExtensions.some(ext => f.endsWith(ext)) &&
    clientDirs.some(d => f.startsWith(d))
  );

  const dangerousPatterns = [
    { regex: /supabase.*service_role/i, label: 'Supabase service role key' },
    { regex: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API key' },
    { regex: /STRIPE_SECRET_KEY/, label: 'Stripe secret key' },
    { regex: /ANTHROPIC_API_KEY/, label: 'Anthropic API key' },
    { regex: /Consumer_Secret/i, label: 'M-Pesa consumer secret' },
    { regex: /AI_API_KEY|ai_api_key/, label: 'AI API key' },
  ];

  let foundSecret = false;
  for (const filePath of suspiciousFiles) {
    const content = ctx.files.get(filePath);
    if (!content) continue;
    for (const { regex, label } of dangerousPatterns) {
      const result = checkLines(content, (line) => regex.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*'));
      if (result.found) {
        results.push({
          checkId: 'security-secrets-client-exposure',
          status: 'fail',
          message: `${label} found in client-side code`,
          file: filePath,
          line: result.lineIndex + 1,
          snippet: content.split('\n')[result.lineIndex].trim(),
        });
        foundSecret = true;
      }
    }
  }
  if (suspiciousFiles.length > 0 && !foundSecret) {
    results.push({ checkId: 'security-secrets-client-exposure', status: 'pass', message: 'No dangerous secrets found in client-side code' });
  }

  const middlewarePaths = ['middleware.ts', 'src/middleware.ts', 'middleware.js'];
  const hasMiddleware = middlewarePaths.some(p => ctx.files.has(p) && ctx.files.get(p) !== null);
  results.push({
    checkId: 'security-auth-middleware',
    status: hasMiddleware ? 'pass' : 'warn',
    message: hasMiddleware ? 'Auth middleware file found' : 'No middleware.ts found — protected routes may be unsecured',
  });

  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allContentJoined = allContent.join('\n');

  const hasCsrf = /csrf|CSRF|csrfToken|SameSite|sameSite|same-site|xsrf|XSRF/.test(allContentJoined);
  results.push({
    checkId: 'security-csrf-protection',
    status: hasCsrf ? 'pass' : 'warn',
    message: hasCsrf ? 'CSRF protection detected' : 'No CSRF protection detected — forms and API mutations may be vulnerable',
  });

  const hasRateLimit = /ratelimit|rate-limit|upstash.*ratelimit|express-rate-limit/.test(allContentJoined);
  results.push({
    checkId: 'security-rate-limiting',
    status: hasRateLimit ? 'pass' : 'warn',
    message: hasRateLimit ? 'Rate limiting detected' : 'No rate limiting found — API may be open to abuse',
  });

  const configContent = ['next.config.ts', 'next.config.js', 'next.config.mjs', '.env', 'vite.config.ts']
    .map(p => ctx.files.get(p))
    .filter(Boolean)
    .join('\n');

  const hasCsp = /Content-Security-Policy|contentSecurityPolicy|\.csp\b/.test(configContent);
  results.push({
    checkId: 'security-csp-configured',
    status: hasCsp ? 'pass' : 'warn',
    message: hasCsp ? 'Content Security Policy (CSP) configured' : 'No CSP found — app may be vulnerable to XSS',
  });

  const hasHsts = /Strict-Transport-Security|HSTS/.test(allContentJoined);
  results.push({
    checkId: 'security-hsts',
    status: hasHsts ? 'pass' : 'warn',
    message: hasHsts ? 'HSTS configured' : 'No HSTS header found — users may connect over HTTP',
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

  const hasXss = /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(allContentJoined);
  results.push({
    checkId: 'security-xss-protection',
    status: hasXss ? 'warn' : 'pass',
    message: hasXss ? 'dangerouslySetInnerHTML or innerHTML assignment found — potential XSS risk' : 'No dangerous HTML assignments found',
  });

  const hasEval = /eval\s*\(/.test(allContentJoined);
  results.push({
    checkId: 'security-eval-usage',
    status: hasEval ? 'fail' : 'pass',
    message: hasEval ? 'eval() usage detected — arbitrary code execution risk' : 'No eval() usage detected',
  });

  const hasXfo = /X-Frame-Options:\s*DENY/.test(allContentJoined);
  results.push({
    checkId: 'security-x-frame-options',
    status: hasXfo ? 'pass' : 'warn',
    message: hasXfo ? 'X-Frame-Options: DENY configured' : 'No X-Frame-Options: DENY found',
  });

  const hasOauth = /OAuth|oauth|passport|next-auth|nextauth|auth\.js/.test(allContentJoined);
  const hasOauthState = /state|PKCE|pkce/.test(allContentJoined);
  if (hasOauth) {
    results.push({
      checkId: 'security-oauth-configured',
      status: hasOauthState ? 'pass' : 'warn',
      message: hasOauthState ? 'OAuth with state/PKCE detected' : 'OAuth detected but state/PKCE not verified',
    });
  }

  const hasInputValidation = /z\.object|yup\.object|\.parse\(|\.safeParse\(|\.validate\(/.test(allContentJoined);
  const hasApiRoutes = ctx.allFilePaths.some(f => f.startsWith('src/app/api/') || f.startsWith('pages/api/'));
  if (hasApiRoutes) {
    results.push({
      checkId: 'security-input-validation',
      status: hasInputValidation ? 'pass' : 'warn',
      message: hasInputValidation ? 'Input validation (Zod/Yup) detected on API routes' : 'No input validation found on API routes',
    });
  }

  const hasPackageLock = ctx.files.has('package-lock.json') || ctx.files.has('yarn.lock') || ctx.files.has('pnpm-lock.yaml');
  results.push({
    checkId: 'security-dependency-vulnerabilities',
    status: hasPackageLock ? 'info' : 'warn',
    message: hasPackageLock ? 'Lock file found — run npm audit for vulnerability scan' : 'No lock file found — dependencies may be vulnerable',
  });

  const hasDebug = /debug:\s*true|debug\s*=\s*true|isDebug\s*=\s*true/.test(allContentJoined);
  results.push({
    checkId: 'security-debug-mode',
    status: hasDebug ? 'warn' : 'pass',
    message: hasDebug ? 'Debug mode enabled in source' : 'No debug mode flags detected',
  });

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

  const hasSqlFiles = ctx.allFilePaths.some(f => f.endsWith('.sql'));
  const hasRls = /row level security|enable rls|CREATE POLICY/.test(allContentJoined);
  results.push({
    checkId: 'security-rls-enabled',
    status: hasSqlFiles && hasRls ? 'pass' : (hasSqlFiles ? 'fail' : 'warn'),
    message: hasSqlFiles && hasRls ? 'Row Level Security enabled in migrations' :
      hasSqlFiles ? 'No RLS policies found in SQL migrations' : 'No SQL migrations found',
  });

  return results;
}

async function runAiSafetyCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allJoined = allContent.join('\n');

  const hasSystemPrompt = /system.*prompt|system_instruction|role.*system/i.test(allJoined);
  const hasUserIsolation = /user.*message|user_input|userContent|USER_SAYS/i.test(allJoined);
  results.push({
    checkId: 'ai-prompt-injection',
    status: hasSystemPrompt && hasUserIsolation ? 'pass' : 'warn',
    message: hasSystemPrompt && hasUserIsolation ? 'User input appears isolated from system prompts' : 'No clear separation between system prompts and user input — risk of prompt injection',
  });

  const hasExternalContent = /fetch\(|axios\.get|https:\/\/|http:\/\//.test(allJoined);
  const hasSanitization = /sanitize|sanitizeInput|DOMPurify|stripHtml|escapeHtml|validator/i.test(allJoined);
  if (hasExternalContent) {
    results.push({
      checkId: 'ai-indirect-prompt-injection',
      status: hasSanitization ? 'pass' : 'warn',
      message: hasSanitization ? 'External content sanitization detected' : 'External content fetched but no sanitization found',
    });
  }

  const hasJailbreakDetect = /jailbreak|harmful.*content|toxic|moderation/i.test(allJoined);
  results.push({
    checkId: 'ai-jailbreak-resistance',
    status: hasJailbreakDetect ? 'pass' : 'info',
    message: hasJailbreakDetect ? 'Jailbreak detection patterns found' : 'No jailbreak resistance mechanisms detected',
  });

  const hasToolPermissions = /tool|function|action|plugin.*permission|scoped/i.test(allJoined);
  results.push({
    checkId: 'ai-tool-permissions',
    status: hasToolPermissions ? 'pass' : 'warn',
    message: hasToolPermissions ? 'Tool/function permission patterns found' : 'No tool permission boundaries detected',
  });

  const hasMemoryMgmt = /memory|store|vector|embedding|recall/i.test(allJoined);
  const hasMemoryValidation = /validate|sanitize|check|filter/i.test(allJoined);
  if (hasMemoryMgmt) {
    results.push({
      checkId: 'ai-memory-poisoning',
      status: hasMemoryValidation ? 'pass' : 'warn',
      message: hasMemoryValidation ? 'Memory input validation detected' : 'Memory/vector storage found but no input validation',
    });
  }

  const hasHallucinationGuard = /citation|source|grounding|confidence|factual|reference/i.test(allJoined);
  results.push({
    checkId: 'ai-hallucination-mitigation',
    status: hasHallucinationGuard ? 'pass' : 'info',
    message: hasHallucinationGuard ? 'Hallucination mitigation patterns found' : 'No hallucination mitigation mechanisms detected',
  });

  const hasPiiMasking = /PII|pii|redact|mask.*email|mask.*phone|deidentify/i.test(allJoined);
  results.push({
    checkId: 'ai-pii-masking',
    status: hasPiiMasking ? 'pass' : 'warn',
    message: hasPiiMasking ? 'PII masking/redaction detected' : 'No PII masking detected — sensitive user data may be exposed to AI providers',
  });

  const hasOutputModeration = /moderation|moderate|content.*filter|flag|block.*output/i.test(allJoined);
  results.push({
    checkId: 'ai-output-moderation',
    status: hasOutputModeration ? 'pass' : 'info',
    message: hasOutputModeration ? 'Output moderation detected' : 'No AI output moderation detected',
  });

  const hasPromptLocking = /system.*instruction|system_prompt|prompt.*template|delimiter|separator/i.test(allJoined);
  results.push({
    checkId: 'ai-prompt-locking',
    status: hasPromptLocking ? 'pass' : 'warn',
    message: hasPromptLocking ? 'Prompt template with system/user separation detected' : 'No prompt locking mechanism detected',
  });

  const hasStructuredOutput = /response_format|json_object|structured.*output|json.*mode/i.test(allJoined);
  results.push({
    checkId: 'ai-json-enforcement',
    status: hasStructuredOutput ? 'pass' : 'info',
    message: hasStructuredOutput ? 'Structured output (JSON mode) detected' : 'No structured output enforcement detected',
  });

  const hasModelPinning = /gpt-4-\d{4}|gpt-3\.5-turbo-\d{4}|claude-\d|claude-instant-\d|gemini-\d.*-\d{3}/i.test(allJoined);
  results.push({
    checkId: 'ai-model-pinning',
    status: hasModelPinning ? 'pass' : 'warn',
    message: hasModelPinning ? 'AI models are pinned to specific versions' : 'Models may use "latest" tag — risk of unexpected behavior changes',
  });

  const hasTempConfig = /temperature|max_tokens|maxTokens/i.test(allJoined);
  results.push({
    checkId: 'ai-temperature-validation',
    status: hasTempConfig ? 'pass' : 'info',
    message: hasTempConfig ? 'Temperature/token configuration found' : 'No temperature or token limit configuration detected',
  });

  const hasTokenLimits = /max_tokens|maxTokens|maxOutputTokens/i.test(allJoined);
  results.push({
    checkId: 'ai-token-limits',
    status: hasTokenLimits ? 'pass' : 'warn',
    message: hasTokenLimits ? 'Token limits configured' : 'No token limits found — unbounded usage may cause cost overruns',
  });

  const hasRag = /rag|retrieval|vector.*store|embedding|similarity/i.test(allJoined);
  const hasRagValidation = /relevance|score|threshold|filter|validate/i.test(allJoined);
  if (hasRag) {
    results.push({
      checkId: 'ai-rag-validation',
      status: hasRagValidation ? 'pass' : 'warn',
      message: hasRagValidation ? 'RAG pipeline with validation detected' : 'RAG pipeline detected but no content validation',
    });
  }

  const hasVectorDb = /vector|pinecone|weaviate|qdrant|chroma|pgvector/i.test(allJoined);
  if (hasVectorDb) {
    const hasVectorProtection = /auth|token|key|validate|sanitize/i.test(allJoined);
    results.push({
      checkId: 'ai-vector-poisoning',
      status: hasVectorProtection ? 'pass' : 'warn',
      message: hasVectorProtection ? 'Vector database access controls detected' : 'Vector database detected but no access controls found',
    });
  }

  const hasFunctionSchema = /functions:|tools:|function_declarations|tool_choice/i.test(allJoined);
  if (hasFunctionSchema) {
    results.push({
      checkId: 'ai-function-schema-validation',
      status: 'pass',
      message: 'Function/tool schemas detected',
    });
  }

  return results;
}

async function runRuntimeCheck(ctx: ScanCtx): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allJoined = allContent.join('\n');

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
    message: hasRetry ? 'Retry logic patterns detected' : 'No retry logic detected — transient failures may cause errors',
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

  const hasLoopProtection = /maxIterations|max_turns|maxSteps|iterationLimit/i.test(allJoined);
  results.push({
    checkId: 'runtime-infinite-loop',
    status: hasLoopProtection ? 'pass' : 'warn',
    message: hasLoopProtection ? 'Iteration limits detected' : 'No infinite loop protection found — AI generation loops may run unbounded',
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
  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allJoined = allContent.join('\n');

  const hasDockerfile = ctx.allFilePaths.some(f => f.includes('Dockerfile') || f === 'docker-compose.yml' || f === 'docker-compose.yaml');
  results.push({
    checkId: 'infra-dockerfile',
    status: hasDockerfile ? 'pass' : 'info',
    message: hasDockerfile ? 'Dockerfile found' : 'No Dockerfile found — container configuration recommended for production',
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
  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allJoined = allContent.join('\n');
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
  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allJoined = allContent.join('\n');
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
    message: hasCodeSplitting ? 'Code splitting detected' : 'No code splitting detected — entire app may load at once',
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
  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allJoined = allContent.join('\n');

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
    message: hasAria ? 'ARIA attributes detected' : 'No ARIA attributes found — screen reader support may be limited',
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
  const allContent = [...ctx.files.values()].filter(Boolean) as string[];
  const allJoined = allContent.join('\n');

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
    ctx = { owner, repo, signal, token, files, allFilePaths: paths };
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

    const engineStages = [
      { idx: 4, cat: 'security' as const, label: 'Security', runner: CATEGORY_RUNNERS['security'] },
      { idx: 5, cat: 'ai-safety' as const, label: 'AI Safety', runner: CATEGORY_RUNNERS['ai-safety'] },
      { idx: 6, cat: 'runtime' as const, label: 'Runtime', runner: CATEGORY_RUNNERS['runtime'] },
      { idx: 6, cat: 'infrastructure' as const, label: 'Infrastructure', runner: CATEGORY_RUNNERS['infrastructure'] },
      { idx: 6, cat: 'observability' as const, label: 'Observability', runner: CATEGORY_RUNNERS['observability'] },
      { idx: 6, cat: 'performance' as const, label: 'Performance', runner: CATEGORY_RUNNERS['performance'] },
      { idx: 6, cat: 'accessibility' as const, label: 'Accessibility', runner: CATEGORY_RUNNERS['accessibility'] },
      { idx: 6, cat: 'compliance' as const, label: 'Compliance', runner: CATEGORY_RUNNERS['compliance'] },
    ];

    const categoryResults: CategoryResult[] = [];

    for (const engine of engineStages) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      stageIndex = engine.idx;
      emitProgress();

      const checks = await engine.runner(ctx);
      const scored = scoreCategory(engine.cat, checks);
      categoryResults.push({
        categoryId: engine.cat,
        categoryLabel: engine.label,
        checks,
        ...scored,
      });
    }

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
