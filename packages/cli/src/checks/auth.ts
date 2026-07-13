import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

/**
 * Check for authentication issues:
 * - Auth middleware file exists (middleware.ts)
 * - Auth secret documented in .env.example
 * - API routes that handle private data have auth checks
 */
export async function runAuthChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const middlewarePaths = [
    path.join(dir, 'middleware.ts'),
    path.join(dir, 'src/middleware.ts'),
    path.join(dir, 'middleware.js'),
  ];

  const hasMiddleware = middlewarePaths.some(fs.existsSync);
  if (hasMiddleware) {
    results.push({ status: 'pass', message: 'Auth middleware file found' });
  } else {
    results.push({ status: 'warn', message: 'No middleware.ts found \u2014 protected routes may be unsecured' });
  }

  const envExamplePath = path.join(dir, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const envExample = fs.readFileSync(envExamplePath, 'utf-8');
    const hasAuthSecret =
      envExample.includes('JWT_SECRET') ||
      envExample.includes('NEXTAUTH_SECRET') ||
      envExample.includes('AUTH_SECRET');
    if (hasAuthSecret) {
      results.push({ status: 'pass', message: 'Auth secret documented in .env.example' });
    } else {
      results.push({ status: 'warn', message: 'No JWT_SECRET or NEXTAUTH_SECRET in .env.example' });
    }
  }

  const apiFiles = await glob(`${dir}/src/app/api/**/*.ts`, { ignore: ['**/node_modules/**'] });
  const suspiciousRoutes: string[] = [];

  for (const file of apiFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const hasAuthCheck =
      content.includes('getServerSession') ||
      content.includes('auth()') ||
      content.includes('verifyToken') ||
      content.includes('supabase.auth') ||
      content.includes('requireAuth') ||
      content.includes('middleware');

    const looksPrivate =
      content.includes('userId') ||
      content.includes('user_id') ||
      content.includes('DELETE') ||
      content.includes('UPDATE') ||
      file.includes('/admin/') ||
      file.includes('/user/') ||
      file.includes('/profile/');

    if (looksPrivate && !hasAuthCheck) {
      suspiciousRoutes.push(path.relative(dir, file));
    }
  }

  if (suspiciousRoutes.length > 0) {
    for (const route of suspiciousRoutes.slice(0, 3)) {
      results.push({
        status: 'warn',
        message: 'No auth check detected in route that may require it',
        file: route,
      });
    }
  } else if (apiFiles.length > 0) {
    results.push({ status: 'pass', message: 'Auth checks found in API routes' });
  }

  return results;
}
