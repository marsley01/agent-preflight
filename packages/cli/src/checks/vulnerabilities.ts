import type { ProjectContext, SourceFile } from '../context.js';
import { type CheckResult, type CheckStatus, type Severity, pass } from '../types.js';

interface Detector {
  id: string;
  re: RegExp;
  status: Exclude<CheckStatus, 'pass' | 'info'>;
  severity: Severity;
  message: string;
  fix: string;
  /** Only report in files where this also matches (e.g. the file imports child_process). */
  fileGuard?: RegExp;
  /** Skip files where this matches (e.g. jwt.verify present alongside jwt.decode). */
  fileExclude?: RegExp;
  /** The pattern needs to see string literal contents (URLs, CORS origins, SQL strings). */
  literals?: boolean;
}

/** User-controlled request input across Express, Next.js, Hono, Fastify, SvelteKit. */
const USER_INPUT = String.raw`(req|request|ctx|c)\.(query|params|body|headers)|searchParams\.get\(|formData\.get\(|params\.\w+`;

const DETECTORS: Detector[] = [
  {
    id: 'injection/eval',
    re: /(?<![\w.$])(eval\s*\(|new\s+Function\s*\()/,
    status: 'fail', severity: 'high',
    message: 'eval() / new Function() — arbitrary code execution risk',
    fix: 'Remove dynamic code evaluation. Parse data with JSON.parse or use a lookup table.',
  },
  {
    id: 'injection/sql-template',
    re: /\.(query|execute|raw|unsafe|\$queryRawUnsafe|\$executeRawUnsafe|whereRaw|orderByRaw)\s*\(\s*`[^`]*\$\{/,
    status: 'fail', severity: 'critical',
    message: 'SQL built with string interpolation — SQL injection',
    fix: 'Use parameterized queries ($1 placeholders) or a tagged template (sql`...`, Prisma.$queryRaw``) that escapes values.',
  },
  {
    id: 'injection/sql-concat',
    re: /\.(query|execute|raw)\s*\(\s*["'`][^"'`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"'`]*["'`]\s*\+/i,
    literals: true,
    status: 'fail', severity: 'critical',
    message: 'SQL built with string concatenation — SQL injection',
    fix: 'Use parameterized queries instead of concatenating values into SQL.',
  },
  {
    id: 'injection/prisma-unsafe',
    re: /\$(queryRawUnsafe|executeRawUnsafe)\s*\(/,
    status: 'warn', severity: 'high',
    message: 'Prisma $queryRawUnsafe/$executeRawUnsafe — make sure no user input reaches it',
    fix: 'Prefer prisma.$queryRaw`...` (tagged template) which parameterizes values automatically.',
  },
  {
    id: 'injection/command',
    re: /\b(exec|execSync)\s*\(\s*(`[^`]*\$\{|[^,)]*\+\s*\w)/,
    fileGuard: /child_process|from\s+['"]node:child_process['"]|shelljs|execa/,
    status: 'fail', severity: 'critical',
    message: 'Shell command built from variables — command injection',
    fix: 'Use execFile/spawn with an argument array (no shell) and validate inputs against an allowlist.',
  },
  {
    id: 'injection/shell-true',
    re: /\bshell\s*:\s*true\b/,
    fileGuard: /child_process|execa/,
    status: 'warn', severity: 'medium',
    message: 'spawn/execFile with shell: true re-enables shell injection',
    fix: 'Drop `shell: true` and pass arguments as an array.',
  },
  {
    id: 'xss/dangerously-set-inner-html',
    re: /dangerouslySetInnerHTML\s*=\s*\{\{?\s*__html/,
    fileExclude: /DOMPurify|sanitize-html|isomorphic-dompurify|xss\(/,
    status: 'warn', severity: 'medium',
    message: 'dangerouslySetInnerHTML without a sanitizer — XSS risk if content is user-controlled',
    fix: 'Sanitize with DOMPurify.sanitize() before rendering, or render as text.',
  },
  {
    id: 'xss/inner-html',
    re: /\.(innerHTML|outerHTML)\s*\+?=(?!=)|\.insertAdjacentHTML\s*\(|document\.write\s*\(/,
    fileExclude: /DOMPurify|sanitize-html/,
    status: 'warn', severity: 'medium',
    message: 'Raw HTML injection (innerHTML / document.write) — XSS risk',
    fix: 'Use textContent, or sanitize with DOMPurify before assigning HTML.',
  },
  {
    id: 'xss/vue-v-html',
    re: /\bv-html\s*=|\{@html\s/,
    fileExclude: /DOMPurify|sanitize/,
    status: 'warn', severity: 'medium',
    message: 'v-html / {@html} renders raw HTML — XSS risk',
    fix: 'Sanitize the content with DOMPurify before rendering.',
  },
  {
    id: 'tls/verification-disabled',
    re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/,
    literals: true,
    status: 'fail', severity: 'high',
    message: 'TLS certificate verification disabled — traffic can be intercepted (MITM)',
    fix: 'Remove the override. For self-signed certs in dev, pass the CA via the `ca` option instead.',
  },
  {
    id: 'jwt/alg-none',
    re: /algorithms?\s*:\s*\[?[^\]\n]*['"]none['"]/i,
    literals: true,
    status: 'fail', severity: 'critical',
    message: 'JWT "none" algorithm accepted — tokens can be forged without a signature',
    fix: 'Pin the expected algorithm, e.g. jwt.verify(token, key, { algorithms: ["HS256"] }).',
  },
  {
    id: 'jwt/decode-without-verify',
    re: /\bjwt\.decode\s*\(|\bjwtDecode\s*\(|\bdecodeJwt\s*\(/,
    fileExclude: /\.verify\s*\(|jwtVerify\s*\(|getUser\s*\(|getClaims\s*\(/,
    status: 'warn', severity: 'high',
    message: 'JWT decoded without verifying its signature — claims can be forged',
    fix: 'Use jwt.verify() / jose jwtVerify() (or supabase.auth.getUser()) before trusting any claim.',
  },
  {
    id: 'jwt/ignore-expiration',
    re: /ignoreExpiration\s*:\s*true/,
    status: 'warn', severity: 'medium',
    message: 'JWT expiration ignored — stolen tokens never expire',
    fix: 'Remove ignoreExpiration and issue short-lived tokens with refresh rotation.',
  },
  {
    id: 'cors/wildcard-with-credentials',
    re: /origin\s*:\s*(['"]\*['"]|true\b)/,
    fileGuard: /credentials\s*:\s*true|Allow-Credentials['"]?\s*[,:]\s*['"]?true/,
    literals: true,
    status: 'fail', severity: 'high',
    message: 'CORS reflects any origin while allowing credentials — any site can make authenticated requests',
    fix: 'Set `origin` to an explicit allowlist of your domains when `credentials: true`.',
  },
  {
    id: 'crypto/insecure-random',
    re: /Math\.random\(\)/,
    fileGuard: /token|secret|password|otp|nonce|salt|api[_-]?key|session|reset/i,
    status: 'warn', severity: 'medium',
    message: 'Math.random() in a file that generates tokens/secrets — predictable values',
    fix: 'Use crypto.randomUUID() or crypto.getRandomValues() / crypto.randomBytes().',
  },
  {
    id: 'crypto/weak-password-hash',
    re: /createHash\(\s*['"](md5|sha1)['"]\s*\)/,
    fileGuard: /password|passwd/i,
    status: 'fail', severity: 'high',
    message: 'Passwords hashed with MD5/SHA-1 — trivially crackable',
    fix: 'Use argon2, bcrypt or scrypt with a per-user salt.',
  },
  {
    id: 'ssrf/user-controlled-url',
    re: new RegExp(String.raw`\b(fetch|axios(\.(get|post|request))?|got|request)\s*\(\s*(${USER_INPUT})`),
    status: 'warn', severity: 'high',
    message: 'HTTP request to a user-controlled URL — SSRF (can reach internal services / cloud metadata)',
    fix: 'Validate the URL against an allowlist of hosts and block private IP ranges.',
  },
  {
    id: 'redirect/open-redirect',
    re: new RegExp(String.raw`\b(redirect|res\.redirect|NextResponse\.redirect|Response\.redirect)\s*\(\s*(${USER_INPUT})`),
    status: 'warn', severity: 'medium',
    message: 'Redirect to a user-controlled URL — open redirect (phishing)',
    fix: 'Only redirect to relative paths or an allowlist of known URLs.',
  },
  {
    id: 'path/traversal',
    re: new RegExp(String.raw`\b(readFile|readFileSync|createReadStream|sendFile|unlink|writeFile)\s*\(\s*[^)]*(${USER_INPUT})`),
    status: 'warn', severity: 'high',
    message: 'Filesystem access with a user-controlled path — path traversal',
    fix: 'Resolve the path and verify it stays inside an allowed base directory; reject `..` segments.',
  },
  {
    id: 'deserialize/unsafe',
    re: /\b(unserialize|node-serialize|serialize-javascript.*eval|yaml\.load\s*\((?![^)]*safe))/,
    status: 'warn', severity: 'high',
    message: 'Unsafe deserialization — can lead to remote code execution',
    fix: 'Use JSON.parse, or yaml.load with the default safe schema (js-yaml v4+).',
  },
  {
    id: 'debug/enabled',
    re: /\b(debug|isDebug|DEBUG)\s*[:=]\s*true\b/,
    status: 'warn', severity: 'low',
    message: 'Debug mode hardcoded on — may expose stack traces and internals in production',
    fix: 'Drive debug flags from NODE_ENV or an env var that defaults to off.',
  },
  {
    id: 'mixed-content/http-url',
    re: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|www\.w3\.org|schemas\.|json-schema\.org|example\.(com|org))[a-z0-9.-]+\.[a-z]{2,}/i,
    literals: true,
    status: 'warn', severity: 'low',
    message: 'Insecure http:// URL — mixed content / plaintext traffic',
    fix: 'Switch to https://.',
  },
];

function guardOk(d: Detector, f: SourceFile): boolean {
  if (d.fileGuard && !d.fileGuard.test(f.content)) return false;
  if (d.fileExclude && d.fileExclude.test(f.content)) return false;
  return true;
}

/** Max findings per rule so one noisy pattern doesn't drown the report. */
const MAX_PER_RULE = 10;

/**
 * Line-level detection of common code vulnerabilities (OWASP Top 10 style).
 * Every finding points at a specific file and line.
 */
export function runVulnerabilityChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const code = ctx.code;

  for (const d of DETECTORS) {
    const files = code.filter((f) => guardOk(d, f));
    const matches = ctx.grep(files, d.re, { literals: d.literals });
    for (const m of matches.slice(0, MAX_PER_RULE)) {
      results.push({ id: d.id, status: d.status, severity: d.severity, message: d.message, file: m.file, line: m.line, snippet: m.text, fix: d.fix });
    }
    if (matches.length > MAX_PER_RULE) {
      results.push({ id: d.id, status: d.status, severity: d.severity, message: `…and ${matches.length - MAX_PER_RULE} more: ${d.message}`, fix: d.fix });
    }
  }

  if (results.length === 0) {
    results.push(pass('vuln/none', `No injection, XSS, TLS, JWT or SSRF patterns found in ${code.length} source files`));
  }
  return results;
}
