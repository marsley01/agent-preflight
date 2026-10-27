import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, warn, info } from '../types.js';
import { findRouteFiles, MUTATING } from './routes.js';

const READS_BODY = /request\.json\(\)|req\.json\(\)|req\.body|request\.formData\(\)|c\.req\.(json|parseBody)\(|await\s+\w+\.json\(\)|formData\.get\(/;
const VALIDATES = /z\.object|z\.string|\.parse\(|\.safeParse\(|yup\.|v\.object|v\.parse|Joi\.|ajv|superstruct|Type\.Object|arktype|zValidator|valibot|class-validator|validationResult|express-validator/;
const RATE_LIMIT_DEPS = ['@upstash/ratelimit', 'express-rate-limit', 'rate-limiter-flexible', 'hono-rate-limiter', '@fastify/rate-limit', 'next-rate-limit', /^@arcjet\//];
const ERROR_LEAK = /(json|send)\s*\(\s*\{[^}]*\b(error|message)\s*:\s*(err|error|e)\.(message|stack)|\.stack\b[^;]*\b(json|send)\(/;

/**
 * Check for API security issues:
 * - Input validation (Zod, Yup, Valibot, Joi, ...) on routes that read a request body
 * - Rate limiting / abuse protection
 * - Internal error details returned to clients
 */
export function runApiChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const routes = findRouteFiles(ctx);

  if (routes.length === 0) {
    return [info('api/not-applicable', 'No API routes found — skipping API checks')];
  }

  const unvalidated = routes.filter((f) => MUTATING.test(f.content) && READS_BODY.test(f.content) && !VALIDATES.test(f.content));
  for (const f of unvalidated.slice(0, 10)) {
    const line = f.lines.findIndex((l) => READS_BODY.test(l)) + 1 || undefined;
    results.push(warn('api/input-validation', 'medium', 'Request body used without schema validation', {
      file: f.rel,
      line,
      fix: 'Parse the body with a schema first: `const body = Schema.parse(await request.json())` (Zod/Valibot).',
    }));
  }
  if (unvalidated.length === 0) {
    results.push(pass('api/input-validation', 'Request bodies are schema-validated'));
  }

  const hasRateLimit = ctx.hasDependency(...RATE_LIMIT_DEPS) || ctx.code.some((f) => /ratelimit|rateLimit|rate-limit|slidingWindow|tokenBucket/i.test(f.content));
  results.push(hasRateLimit
    ? pass('api/rate-limit', 'Rate limiting detected')
    : warn('api/rate-limit', 'medium', 'No rate limiting found — login, signup and AI endpoints are open to abuse and cost spikes', {
      fix: 'Add @upstash/ratelimit (serverless) or express-rate-limit, or a WAF rate-limit rule at your host.',
    }));

  const leaks = ctx.grep(routes, ERROR_LEAK);
  for (const m of leaks.slice(0, 5)) {
    results.push(warn('api/error-leak', 'low', 'Raw error message/stack returned to the client — leaks internals', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Log the error server-side and return a generic message with a request ID.',
    }));
  }

  return results;
}
