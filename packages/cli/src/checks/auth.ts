import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, warn, info } from '../types.js';
import { findRouteFiles, MUTATING, AUTH_SIGNAL, WEBHOOK } from './routes.js';

const MIDDLEWARE = /^(src\/)?(middleware|proxy)\.[jt]s$|(^|\/)hooks\.server\.[jt]s$/;
const PRIVATE_HINT = /userId|user_id|\bdb\.|prisma\.|supabase\.from|\.from\(['"]|insert|update|delete|admin/i;

/**
 * Check for authentication issues:
 * - Auth middleware present (Next.js middleware/proxy, SvelteKit hooks)
 * - Mutating route handlers that touch data with no visible auth check
 * - Auth secret documented in .env.example (only when an auth library is used)
 */
export function runAuthChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const routes = findRouteFiles(ctx);

  if (routes.length === 0) {
    return [info('auth/not-applicable', 'No server route handlers found — skipping auth checks')];
  }

  const middleware = ctx.code.find((f) => MIDDLEWARE.test(f.rel));
  const middlewareAuth = middleware && AUTH_SIGNAL.test(middleware.content);
  if (middlewareAuth) {
    results.push(pass('auth/middleware', 'Auth middleware found', { file: middleware.rel }));
  } else if (middleware) {
    results.push(warn('auth/middleware', 'low', 'Middleware exists but no auth check detected in it', { file: middleware.rel }));
  } else if (ctx.hasDependency('next', '@sveltejs/kit')) {
    results.push(warn('auth/middleware', 'low', 'No middleware.ts / hooks.server.ts — every route must check auth itself'));
  }

  const unprotected = routes.filter((f) =>
    MUTATING.test(f.content) &&
    PRIVATE_HINT.test(f.content) &&
    !AUTH_SIGNAL.test(f.content) &&
    !WEBHOOK.test(f.rel) &&
    !/(^|\/)(auth|login|signup|register|signin|public)\b/i.test(f.rel),
  );

  for (const f of unprotected.slice(0, 10)) {
    results.push(warn('auth/unprotected-mutation', middlewareAuth ? 'low' : 'high',
      'Route writes data but has no visible auth check — anyone may be able to call it', {
        file: f.rel,
        fix: 'Verify the session at the top of the handler (e.g. `const user = await getUser(); if (!user) return new Response(null, { status: 401 })`).',
      }));
  }
  if (unprotected.length === 0) {
    results.push(pass('auth/route-guards', `Auth checks found on mutating routes (${routes.length} route files scanned)`));
  }

  const usesAuthLib = ctx.hasDependency('next-auth', '@auth/core', 'jsonwebtoken', 'jose', 'lucia', 'better-auth', 'passport', 'express-session');
  const envExample = ctx.first('.env.example', '.env.sample', '.env.template');
  if (usesAuthLib && envExample) {
    results.push(/JWT_SECRET|NEXTAUTH_SECRET|AUTH_SECRET|SESSION_SECRET|BETTER_AUTH_SECRET/.test(envExample.content)
      ? pass('auth/secret-documented', 'Auth secret documented in .env.example')
      : warn('auth/secret-documented', 'low', 'Auth library in use but no AUTH_SECRET / JWT_SECRET in .env.example', { file: envExample.rel }));
  }

  return results;
}
