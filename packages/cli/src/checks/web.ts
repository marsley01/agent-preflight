import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, fail, warn, info } from '../types.js';
import { isClientFile } from './security.js';

/** Places security headers are commonly configured. */
const HEADER_SOURCES = /^(src\/)?(server|app|index|main)\.[cm]?[jt]s$|(^|\/)(next\.config\.[cm]?[jt]s|vercel\.json|netlify\.toml|_headers|nginx\.conf|\.htaccess|web\.config|(src\/)?middleware\.[jt]s|(src\/)?proxy\.[jt]s|hooks\.server\.[jt]s|astro\.config\.[cm]?[jt]s|nuxt\.config\.[jt]s|svelte\.config\.js|vite\.config\.[jt]s)$/;

/**
 * Check for web security issues:
 * - Security headers (CSP, clickjacking, nosniff, HSTS, Referrer-Policy) — or helmet
 * - Production source maps
 * - Cookie flags (httpOnly, secure, sameSite)
 */
export function runWebChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const sources = ctx.find(HEADER_SOURCES);
  const isWebApp = ctx.hasDependency('next', 'express', 'fastify', 'hono', 'koa', '@sveltejs/kit', 'nuxt', 'astro', 'vite', 'react-scripts', '@remix-run/node');

  if (!isWebApp && sources.length === 0) {
    return [info('web/not-applicable', 'No web framework detected — skipping security header checks')];
  }

  const config = sources.map((f) => f.content).join('\n');
  const usesHelmet = ctx.hasDependency('helmet', '@fastify/helmet') || /\bhelmet\s*\(/.test(config);
  const where = sources.length ? ` (looked in ${sources.slice(0, 3).map((f) => f.rel).join(', ')})` : '';

  const headers: { id: string; label: string; re: RegExp; missing: string; fix: string }[] = [
    {
      id: 'headers/csp', label: 'Content-Security-Policy', re: /Content-Security-Policy|contentSecurityPolicy/i,
      missing: 'No Content-Security-Policy header — XSS has no second line of defense',
      fix: "Add a CSP header, starting with `default-src 'self'` and tightening from there.",
    },
    {
      id: 'headers/clickjacking', label: 'X-Frame-Options / frame-ancestors', re: /X-Frame-Options|frame-ancestors|frameguard/i,
      missing: 'No clickjacking protection — your app can be embedded in a malicious iframe',
      fix: "Send `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`.",
    },
    {
      id: 'headers/nosniff', label: 'X-Content-Type-Options', re: /X-Content-Type-Options|nosniff|noSniff/i,
      missing: 'No X-Content-Type-Options: nosniff — browsers may MIME-sniff responses',
      fix: 'Send `X-Content-Type-Options: nosniff`.',
    },
    {
      id: 'headers/hsts', label: 'Strict-Transport-Security', re: /Strict-Transport-Security|\bhsts\b/i,
      missing: 'No HSTS header — first visits can be downgraded to HTTP',
      fix: 'Send `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (Vercel/Netlify add this on their domains, not custom ones).',
    },
    {
      id: 'headers/referrer-policy', label: 'Referrer-Policy', re: /Referrer-Policy|referrerPolicy/i,
      missing: 'No Referrer-Policy — full URLs (with tokens in query strings) leak to third parties',
      fix: 'Send `Referrer-Policy: strict-origin-when-cross-origin`.',
    },
  ];

  for (const h of headers) {
    if (usesHelmet || h.re.test(config)) {
      results.push(pass(h.id, `${h.label} configured${usesHelmet && !h.re.test(config) ? ' (via helmet)' : ''}`));
    } else {
      results.push(warn(h.id, h.id === 'headers/csp' ? 'medium' : 'low', h.missing + where, { fix: h.fix }));
    }
  }

  // --- Source maps shipped to production ---
  const sourcemaps = ctx.grep(ctx.find(/(^|\/)(next|vite)\.config\.[cm]?[jt]s$/), /productionBrowserSourceMaps\s*:\s*true|sourcemap\s*:\s*true/);
  for (const m of sourcemaps) {
    results.push(warn('web/production-sourcemaps', 'low', 'Source maps published in production — your original source is downloadable', {
      file: m.file, line: m.line, snippet: m.text,
      fix: "Use `sourcemap: 'hidden'` and upload maps to your error tracker instead.",
    }));
  }

  // --- Cookies ---
  // httpOnly can only be set server-side, so browser code and helper definitions are out of scope.
  const serverCode = ctx.code.filter((f) => !isClientFile(ctx, f));
  const cookieSetters = ctx.grep(serverCode,/(cookies\(\)\.set|\bres\.cookie|\.cookies\.set|\bsetCookie|\bcookie\.serialize)\s*\(|['"]Set-Cookie['"]/);
  if (cookieSetters.length === 0) {
    results.push(info('cookies/none', 'No cookies set by application code'));
  } else {
    const insecure = cookieSetters.filter((m) => {
      if (/^(export\s+)?(async\s+)?function\b|^(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/.test(m.text)) return false;
      const f = ctx.files.get(m.file)!;
      const window = f.lines.slice(m.line - 1, m.line + 8).join('\n');
      return /session|token|auth|jwt|sid/i.test(window) && !/httpOnly\s*:\s*true|HttpOnly/i.test(window);
    });
    for (const m of insecure.slice(0, 5)) {
      results.push(fail('cookies/missing-httponly', 'high', 'Session/auth cookie set without httpOnly — readable by any XSS payload', {
        file: m.file, line: m.line, snippet: m.text,
        fix: "Set `{ httpOnly: true, secure: true, sameSite: 'lax' }` on session cookies.",
      }));
    }
    if (insecure.length === 0) results.push(pass('cookies/flags', 'Auth cookies set with httpOnly'));
  }

  return results;
}
