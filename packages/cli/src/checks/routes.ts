import type { ProjectContext, SourceFile } from '../context.js';

const ROUTE_PATH = /(^|\/)(app|src\/app)\/(.+\/)?route\.[cm]?[jt]sx?$|(^|\/)pages\/api\/|\+server\.[jt]s$|(^|\/)(api|routes|controllers|handlers)\/.+\.[cm]?[jt]s$/;
const ROUTER_CALL = /\b(app|router|server|api|fastify|hono)\.(get|post|put|patch|delete|all|route)\s*\(/;
const SERVER_ACTION = /^\s*['"]use server['"]/m;

export const MUTATING = /export\s+(async\s+)?(function|const)\s+(POST|PUT|PATCH|DELETE)\b|\.(post|put|patch|delete)\s*\(|['"]use server['"]|req\.method\s*===?\s*['"](POST|PUT|PATCH|DELETE)['"]|export\s+(const|async function)\s+actions?\b/;

export const AUTH_SIGNAL = /getServerSession|getToken\(|\bauth\(\)|currentUser\(|getAuth\(|\.auth\.getUser\(|\.auth\.getClaims\(|getSession\(|verifyToken|requireAuth|requireUser|withAuth|jwtVerify|jwt\.verify|req\.user\b|isAuthenticated|passport\.authenticate|validateRequest|locals\.(user|session)|clerkMiddleware|authMiddleware|getKindeServerSession|ensureAuth|protectedProcedure|unauthorized|Unauthorized|401/;

export const WEBHOOK = /webhook|callback|stripe|mpesa|daraja|cron/i;

/** Server-side request handlers: Next.js route handlers, pages/api, SvelteKit, Express-style routers, server actions. */
export function findRouteFiles(ctx: ProjectContext): SourceFile[] {
  return ctx.code.filter((f) => ROUTE_PATH.test(f.rel) || ROUTER_CALL.test(f.content) || SERVER_ACTION.test(f.content));
}
