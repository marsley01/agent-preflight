import type { ProjectContext } from './context.js';

export type Provider = 'supabase' | 'neon' | 'railway' | 'rds' | 'vercel-postgres' | 'postgres' | 'firebase' | 'mongodb' | 'convex' | 'pocketbase' | 'appwrite';

export interface Stack {
  framework?: string;
  orms: string[];
  provider?: Provider;
  /**
   * How browsers can reach the database directly (Supabase client, Neon Data API, PostgREST, Hasura).
   * When set, every table needs RLS; when empty, the app's own API is the only way in.
   */
  browserAccess: string[];
}

const PROVIDER_LABEL: Record<Provider, string> = {
  supabase: 'Supabase',
  neon: 'Neon Postgres',
  railway: 'Railway Postgres',
  rds: 'AWS RDS Postgres',
  'vercel-postgres': 'Vercel Postgres',
  postgres: 'Postgres',
  firebase: 'Firebase',
  mongodb: 'MongoDB',
  convex: 'Convex',
  pocketbase: 'PocketBase',
  appwrite: 'Appwrite',
};

const cache = new WeakMap<ProjectContext, Stack>();

/** Text of env templates and DB/ORM config files, where connection strings and env names live. */
function configText(ctx: ProjectContext): string {
  return ctx
    .find(/(^|\/)(\.env[^/]*|[\w.-]*\.env\.[\w.-]+|drizzle\.config\.[cm]?[jt]s|schema\.prisma|knexfile\.[cm]?[jt]s|kysely\.config\.[cm]?[jt]s|docker-compose\.ya?ml|railway\.(json|toml)|vercel\.json|fly\.toml)$/)
    .map((f) => f.content)
    .join('\n');
}

/** Detect framework, ORM(s), database provider and browser exposure from deps, config files and env names. */
export function detectStack(ctx: ProjectContext): Stack {
  const cached = cache.get(ctx);
  if (cached) return cached;

  const has = (...names: (string | RegExp)[]) => ctx.hasDependency(...names);
  const config = configText(ctx);

  const framework =
    has('next') ? 'Next.js'
      : has('@remix-run/node', '@remix-run/react', '@react-router/node') ? 'Remix'
        : has('@sveltejs/kit') ? 'SvelteKit'
          : has('nuxt') ? 'Nuxt'
            : has('astro') ? 'Astro'
              : has('hono') ? 'Hono'
                : has('express') ? 'Express'
                  : has('fastify') ? 'Fastify'
                    : has('vite') ? 'Vite'
                      : undefined;

  const orms: string[] = [];
  if (has('drizzle-orm') || ctx.find(/(^|\/)drizzle\.config\.[cm]?[jt]s$/).length) orms.push('Drizzle');
  if (has('@prisma/client', 'prisma') || ctx.find(/\.prisma$/).length) orms.push('Prisma');
  if (has('kysely')) orms.push('Kysely');
  if (has('knex')) orms.push('Knex');
  if (has('typeorm')) orms.push('TypeORM');
  if (has('sequelize')) orms.push('Sequelize');
  if (orms.length === 0 && has('postgres')) orms.push('postgres.js');
  if (orms.length === 0 && has('pg')) orms.push('node-postgres');

  const supabase = has('@supabase/supabase-js', '@supabase/ssr', '@supabase/auth-helpers-nextjs') || ctx.allPaths.some((p) => /(^|\/)supabase\/(config\.toml|migrations\/)/.test(p));
  const neonDataApi = has('@neon/neon-js', '@neon/postgrest-js') || /\.apirest\.[\w.-]*neon\.tech|NEON_DATA_API_URL/.test(config);
  const neon = neonDataApi || has('@neondatabase/serverless') || /neon\.tech|\bNEON_[A-Z_]+=|neondb_owner/.test(config);

  const provider: Provider | undefined =
    supabase ? 'supabase'
      : neon ? 'neon'
        : has('@vercel/postgres') || /POSTGRES_PRISMA_URL|POSTGRES_URL_NON_POOLING/.test(config) ? 'vercel-postgres'
          : /rlwy\.net|railway\.app|RAILWAY_/.test(config) || ctx.exists('railway.json') || ctx.exists('railway.toml') ? 'railway'
            : /rds\.amazonaws\.com/.test(config) ? 'rds'
              : has('firebase', 'firebase-admin') ? 'firebase'
                : has('mongoose', 'mongodb') ? 'mongodb'
                  : has('convex') ? 'convex'
                    : has('pocketbase') ? 'pocketbase'
                      : has('appwrite', 'node-appwrite') ? 'appwrite'
                        : orms.length || /postgres(ql)?:\/\//.test(config) ? 'postgres'
                          : undefined;

  const browserAccess: string[] = [];
  if (supabase) browserAccess.push('Supabase client');
  if (neonDataApi) browserAccess.push('Neon Data API');
  if (!supabase && (has('@supabase/postgrest-js') || /image:\s*['"]?postgrest\/postgrest/.test(config))) browserAccess.push('PostgREST');
  if (has('@hasura/client', 'graphql-hasura') || /HASURA_GRAPHQL_/.test(config) || ctx.exists('hasura/config.yaml')) browserAccess.push('Hasura');

  const stack = { framework, orms, provider, browserAccess };
  cache.set(ctx, stack);
  return stack;
}

/** "Next.js · Drizzle · Neon Postgres", or undefined when nothing was detected. */
export function describeStack(stack: Stack): string | undefined {
  const parts = [stack.framework, ...stack.orms, stack.provider ? PROVIDER_LABEL[stack.provider] : undefined].filter(Boolean) as string[];
  if (stack.browserAccess.some((b) => b !== 'Supabase client')) parts.push(`browser access via ${stack.browserAccess.filter((b) => b !== 'Supabase client').join(', ')}`);
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * SQL predicate for "the current user owns this row", in the dialect of the detected platform.
 * Supabase: auth.uid(). Neon RLS: auth.user_id() (returns the JWT `sub` as text).
 * Plain Postgres has no built-in auth function, so suggest a session setting.
 */
export function ownerPredicate(stack: Stack, column = 'user_id'): string {
  if (stack.provider === 'supabase') return `(select auth.uid()) = ${column}`;
  if (stack.provider === 'neon') return `(select auth.user_id()) = ${column}`;
  return `${column} = current_setting('app.user_id')::uuid`;
}

/** Fix hint for a table without RLS, matching the platform and ORM. */
export function rlsFix(stack: Stack, table: string): string {
  if (stack.orms.includes('Drizzle') && stack.provider === 'neon') {
    return `Add a policy in the Drizzle schema (it enables RLS): pgTable('${table}', {...}, (t) => [crudPolicy({ role: authenticatedRole, read: authUid(t.userId), modify: authUid(t.userId) })]) with crudPolicy, authenticatedRole and authUid from 'drizzle-orm/neon'. Use pgTable.withRLS('${table}', ...) for default-deny.`;
  }
  if (stack.orms.includes('Drizzle')) {
    return `Add a pgPolicy to the table in the Drizzle schema (any policy enables RLS), or use pgTable.withRLS('${table}', ...) for default-deny.`;
  }
  return `alter table ${table} enable row level security;  then add policies, e.g. create policy "own rows" on ${table} for all using (${ownerPredicate(stack)});`;
}
