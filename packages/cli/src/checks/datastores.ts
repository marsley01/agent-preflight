import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, fail, warn } from '../types.js';
import { isClientFile } from './security.js';
import { findRouteFiles } from './routes.js';

/** Server-only database drivers. Browser SDKs (supabase-js, firebase, convex) are deliberately absent. */
const SERVER_DRIVERS = /^(pg|pg-promise|mysql|mysql2|postgres|@neondatabase\/serverless|@planetscale\/database|@libsql\/client|@prisma\/client|mongoose|mongodb|ioredis|redis|firebase-admin|knex|kysely|sequelize|typeorm|better-sqlite3|drizzle-orm\/(node-postgres|mysql2|postgres-js|neon-http|libsql|better-sqlite3))$/;
const IMPORT_FROM = /(?:import\s[^'"]*from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
const LOCAL_HOST = /localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal/;

function firebaseChecks(ctx: ProjectContext): CheckResult[] {
  const usesFirebase = ctx.hasDependency('firebase', 'firebase-admin') || ctx.exists('firebase.json');
  const rulesFiles = ctx.find(/(^|\/)[\w.-]*\.rules$/);
  const rtdbRules = ctx.find(/(^|\/)database\.rules\.json$/);
  if (!usesFirebase && rulesFiles.length === 0 && rtdbRules.length === 0) return [];

  const results: CheckResult[] = [];
  if (rulesFiles.length === 0 && rtdbRules.length === 0) {
    results.push(warn('db/firebase-no-rules', 'medium', 'Firebase is used but no security rules are in the repo, so they can\'t be reviewed', {
      fix: 'Run `firebase init firestore` (and storage) to pull firestore.rules / storage.rules into the repo and deploy them from there.',
    }));
  }

  // `allow x;` with no condition, or `allow x: if true;`, grants x to everyone.
  for (const m of ctx.grep(rulesFiles, /allow\s+([a-z][\w\s,]*?)\s*(?::\s*if\s+true\s*)?;/)) {
    const ops = m.match[1];
    if (/write|create|update|delete/.test(ops)) {
      results.push(fail('db/firebase-open-rules', 'critical', `Firebase rule lets anyone on the internet ${ops.trim()}`, {
        file: m.file, line: m.line, snippet: m.text,
        fix: 'Require auth and ownership, e.g. `allow write: if request.auth != null && request.auth.uid == userId;`.',
      }));
    } else {
      results.push(warn('db/firebase-public-read', 'medium', 'Firebase rule makes this data readable by anyone: fine for public listings, never for user data', {
        file: m.file, line: m.line, snippet: m.text,
        fix: 'If the data is private, require `request.auth.uid` to match the owner.',
      }));
    }
  }
  for (const m of ctx.grep(rulesFiles, /request\.time\s*<\s*timestamp\.date\(/)) {
    results.push(fail('db/firebase-open-rules', 'critical', 'Firebase "test mode" rules: the database is open to everyone until the date expires', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Replace test-mode rules with real per-user rules before launch.',
    }));
  }
  for (const f of rulesFiles) {
    const wildcard = f.content.match(/match\s+\/\{document=\*\*\}\s*\{[^}]*allow[^}]*request\.auth\s*!=\s*null[^}]*\}/);
    if (wildcard && !/request\.auth\.uid\s*==/.test(wildcard[0])) {
      results.push(warn('db/firebase-auth-only', 'medium', 'Any signed-in user can read and write every document', {
        file: f.rel, line: f.content.slice(0, wildcard.index).split('\n').length,
        fix: 'Scope rules per collection and check ownership: `request.auth.uid == resource.data.ownerId`.',
      }));
    }
  }
  for (const m of ctx.grep(rtdbRules, /"\.(read|write)"\s*:\s*(true|"true")/, { literals: true })) {
    results.push(fail('db/firebase-open-rules', 'critical', 'Realtime Database rule is open to everyone', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Use `"auth != null && auth.uid === $uid"` style rules per path.',
    }));
  }
  return results;
}

function mongoChecks(ctx: ProjectContext): CheckResult[] {
  if (!ctx.hasDependency('mongoose', 'mongodb')) return [];
  const results: CheckResult[] = [];
  const USER = String.raw`(?:req|request|ctx|c)\.(?:body|query|params)|body\b|await\s+(?:req|request)\.json\(\)`;
  const injection = new RegExp(String.raw`\.(find|findOne|findOneAndUpdate|findOneAndDelete|updateOne|updateMany|deleteOne|deleteMany|countDocuments|exists)\(\s*(\{\s*\.\.\.\s*)?(${USER})\s*[,)}]`);
  for (const m of ctx.grep(ctx.code, injection).slice(0, 10)) {
    results.push(fail('db/nosql-injection', 'high', 'Request data passed straight into a MongoDB query: operator injection ({"$ne": null}) bypasses filters and logins', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Validate with a schema and build the filter from specific fields, e.g. `{ email: String(body.email) }`. Consider `mongo-sanitize` or Mongoose `sanitizeFilter`.',
    }));
  }
  for (const m of ctx.grep(ctx.code, /['"]?\$where['"]?\s*:/, { literals: true }).slice(0, 5)) {
    results.push(warn('db/mongo-where', 'high', '$where runs JavaScript inside the database: injection becomes code execution', {
      file: m.file, line: m.line, snippet: m.text, fix: 'Rewrite with regular query operators or an aggregation pipeline.',
    }));
  }
  return results;
}

function prismaChecks(ctx: ProjectContext): CheckResult[] {
  const schemas = ctx.find(/(^|\/)schema\.prisma$|(^|\/)prisma\/schema\/[\w-]+\.prisma$/);
  if (schemas.length === 0 && !ctx.hasDependency('@prisma/client')) return [];
  const results: CheckResult[] = [];
  for (const m of ctx.grep(schemas, /^\s*(url|directUrl|shadowDatabaseUrl)\s*=\s*"/, { literals: true })) {
    results.push(fail('db/prisma-hardcoded-url', 'high', 'Database URL hardcoded in the Prisma schema', {
      file: m.file, line: m.line, fix: 'Use `url = env("DATABASE_URL")` and keep the value in .env.',
    }));
  }
  const perRequest = findRouteFiles(ctx).filter((f) => /new\s+PrismaClient\s*\(/.test(f.content) && !/globalThis|global\.prisma|globalForPrisma/.test(f.content));
  for (const f of perRequest.slice(0, 5)) {
    results.push(warn('db/client-per-request', 'medium', 'New PrismaClient in a route file: each serverless instance opens its own pool and exhausts database connections', {
      file: f.rel, fix: 'Create one client in lib/prisma.ts (cached on globalThis in development) and import it everywhere.',
    }));
  }
  return results;
}

function convexChecks(ctx: ProjectContext): CheckResult[] {
  if (!ctx.hasDependency('convex')) return [];
  const fns = ctx.code.filter((f) => /(^|\/)convex\/(?!_generated\/)/.test(f.rel) && /export\s+const\s+\w+\s*=\s*(mutation|action)\s*\(/.test(f.content));
  return fns
    .filter((f) => !/getUserIdentity\s*\(|getAuthUserId\s*\(|requireUser|requireAuth/.test(f.content))
    .slice(0, 5)
    .map((f) => warn('db/convex-public-mutation', 'medium', 'Convex mutation/action never checks who is calling: anyone can invoke it from the browser', {
      file: f.rel, fix: 'Start each handler with `const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error("Unauthorized");`, or make it an internalMutation.',
    }));
}

function pocketbaseAppwriteChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const migrations = ctx.find(/(^|\/)pb_migrations\/.+\.(js|json)$/);
  for (const m of ctx.grep(migrations, /["']?(create|update|delete|list|view)Rule["']?\s*[:=]\s*(""|'')/, { literals: true })) {
    const write = /create|update|delete/.test(m.match[1]);
    results.push(warn('db/pocketbase-open-rule', write ? 'high' : 'medium', `PocketBase ${m.match[1]}Rule is "" which means anyone, including logged-out users`, {
      file: m.file, line: m.line, snippet: m.text, fix: 'Use null (admins only) or a rule like `@request.auth.id != "" && owner = @request.auth.id`.',
    }));
  }
  if (ctx.hasDependency('appwrite', 'node-appwrite')) {
    for (const m of ctx.grep(ctx.code, /Permission\.(write|update|delete|create)\s*\(\s*Role\.any\(\)\s*\)/)) {
      results.push(warn('db/appwrite-public-write', 'high', `Appwrite ${m.match[1]} permission granted to Role.any(): anyone can ${m.match[1]} this data`, {
        file: m.file, line: m.line, snippet: m.text, fix: 'Grant write permissions to Role.user(userId) or a team instead.',
      }));
    }
  }
  return results;
}

function genericChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  for (const f of ctx.code.filter((file) => isClientFile(ctx, file))) {
    for (const m of f.content.matchAll(IMPORT_FROM)) {
      if (!SERVER_DRIVERS.test(m[1]) || /^\s*import\s+type\b/.test(m[0])) continue;
      // TypeScript erases imports only used as types (`import { User } from '@prisma/client'`),
      // so only flag bindings that are constructed, called, or have methods called on them.
      const statement = m[0];
      const names = [...statement.replace(/from\s*['"][^'"]+['"]$/, '').replace(/\btype\s+\w+\s*,?/g, '').matchAll(/(?:\*\s+as\s+|\{|,|import\s+)\s*(\w+)(?:\s+as\s+(\w+))?/g)]
        .map((n) => n[2] ?? n[1])
        .filter((n) => n && !['import', 'from', 'type', 'require'].includes(n));
      const rest = f.content.replace(statement, '');
      const usedAsValue = m[0].startsWith('require') || m[0].startsWith('import(') || names.some((n) => new RegExp(String.raw`new\s+${n}\b|\b${n}\s*\(|\b${n}\.\w+\s*\(`).test(rest));
      if (!usedAsValue) continue;
      const line = f.content.slice(0, m.index).split('\n').length;
      if (ctx.isSuppressed(f, line)) continue;
      results.push(fail('db/driver-in-client', 'critical', `Server database driver "${m[1]}" imported in client-side code: credentials and queries ship to the browser`, {
        file: f.rel, line, fix: 'Move database access into API routes or server actions, and mark the module with `import "server-only"`.',
      }));
    }
  }
  for (const m of ctx.grep([...ctx.code, ...ctx.find(/(^|\/)(\.env\.example|docker-compose\.ya?ml|schema\.prisma|drizzle\.config\.[jt]s)$/)], /sslmode=disable|\bssl\s*:\s*false\b|\btls=false\b|rejectUnauthorized\s*:\s*false/, { literals: true })) {
    if (LOCAL_HOST.test(m.text) || /\b(dev|test|local)\b/i.test(m.file)) continue;
    results.push(warn('db/ssl-disabled', 'medium', 'Database connection with TLS turned off: credentials and data travel in plaintext', {
      file: m.file, line: m.line, snippet: m.text, fix: 'Use sslmode=require (or ssl: true) for every non-local database.',
    }));
  }
  return results;
}

/** Non-Supabase data stores: Firebase, MongoDB, Prisma, Convex, PocketBase, Appwrite, and any driver. */
export function runDataStoreChecks(ctx: ProjectContext): { results: CheckResult[]; detected: string[] } {
  const detected: string[] = [];
  const add = (name: string, out: CheckResult[], used: boolean) => {
    if (used) detected.push(name);
    return out;
  };
  const results = [
    ...add('Firebase', firebaseChecks(ctx), ctx.hasDependency('firebase', 'firebase-admin') || ctx.find(/\.rules$|database\.rules\.json$/).length > 0),
    ...add('MongoDB', mongoChecks(ctx), ctx.hasDependency('mongoose', 'mongodb')),
    ...add('Prisma', prismaChecks(ctx), ctx.hasDependency('@prisma/client', 'prisma') || ctx.find(/\.prisma$/).length > 0),
    ...add('Convex', convexChecks(ctx), ctx.hasDependency('convex')),
    ...add('PocketBase/Appwrite', pocketbaseAppwriteChecks(ctx), ctx.hasDependency('appwrite', 'node-appwrite', 'pocketbase') || ctx.find(/pb_migrations\//).length > 0),
    ...genericChecks(ctx),
  ];
  if (ctx.hasDependency(SERVER_DRIVERS)) detected.push('SQL/driver');
  if (results.length === 0 && detected.length > 0) {
    results.push(pass('db/datastores', `No issues in ${detected.join(', ')} configuration`));
  }
  return { results, detected };
}
