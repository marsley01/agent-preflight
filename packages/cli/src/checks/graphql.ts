import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, warn, info } from '../types.js';

const GQL_SERVER_DEPS = ['@apollo/server', 'apollo-server', 'apollo-server-express', 'graphql-yoga', 'mercurius', 'express-graphql', 'graphql-http', '@graphql-yoga/node', 'type-graphql', '@nestjs/graphql', 'pothos', '@pothos/core'];
const GQL_SERVER_CODE = /new\s+ApolloServer|createYoga|createHandler|graphqlHTTP|mercurius|GraphQLModule\.forRoot/;

/**
 * Check GraphQL *servers* (client-only usage is skipped):
 * - Query depth / complexity limiting
 * - Introspection disabled in production
 * - Auth in the resolver context
 */
export function runGraphqlChecks(ctx: ProjectContext): CheckResult[] {
  const servers = ctx.code.filter((f) => GQL_SERVER_CODE.test(f.content));
  if (servers.length === 0 && !ctx.hasDependency(...GQL_SERVER_DEPS)) {
    return [info('graphql/not-applicable', 'No GraphQL server detected — skipping GraphQL checks')];
  }

  const results: CheckResult[] = [];
  const all = servers.map((f) => f.content).join('\n');
  const file = servers[0]?.rel;

  const hasDepthLimit = ctx.hasDependency('graphql-depth-limit', 'graphql-query-complexity', '@escape.tech/graphql-armor', 'graphql-armor', '@envelop/depth-limit')
    || /depthLimit|maxDepth|costLimit|queryComplexity|createComplexityRule/.test(all);
  results.push(hasDepthLimit
    ? pass('graphql/depth-limit', 'Query depth/complexity limiting found')
    : warn('graphql/depth-limit', 'medium', 'No depth or complexity limit — a single nested query can exhaust your server', {
      file, fix: 'Add graphql-armor or graphql-depth-limit as a validation rule.',
    }));

  const introspectionOff = /introspection\s*:\s*(false|process\.env\.NODE_ENV\s*!==?\s*['"]production['"]|!\s*isProd|isDev)/.test(all)
    || /useDisableIntrospection|NoSchemaIntrospectionCustomRule/.test(all);
  results.push(introspectionOff
    ? pass('graphql/introspection', 'Introspection disabled in production')
    : warn('graphql/introspection', 'low', 'Introspection may be enabled in production — your full schema is public', {
      file, fix: "Set `introspection: process.env.NODE_ENV !== 'production'`.",
    }));

  const hasAuthContext = /context\s*:[\s\S]{0,400}(token|auth|session|user|authorization)/i.test(all);
  results.push(hasAuthContext
    ? pass('graphql/auth-context', 'Auth information passed into resolver context')
    : warn('graphql/auth-context', 'high', 'No auth in GraphQL context — resolvers cannot check who is calling', {
      file, fix: 'Resolve the user from the Authorization header in `context` and check it in resolvers.',
    }));

  return results;
}
