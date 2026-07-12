import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

export async function runApiChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const apiFiles: string[] = await glob(`${dir}/src/app/api/**/*.ts`, {
    ignore: ['**/node_modules/**']
  });

  if (apiFiles.length === 0) {
    const altFiles = await glob(`${dir}/pages/api/**/*.ts`, { ignore: ['**/node_modules/**'] });
    if (altFiles.length === 0) {
      results.push({ status: 'warn', message: 'No API routes found \u2014 skipping API checks' });
      return results;
    }
    apiFiles.push(...altFiles);
  }

  let validatedRoutes = 0;
  const unvalidatedRoutes: string[] = [];

  for (const file of apiFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const hasPOST = content.includes('POST') || content.includes('req.body') || content.includes('request.json()');
    const hasValidation =
      content.includes('z.object') ||
      content.includes('yup.object') ||
      content.includes('v.object') ||
      content.includes('.parse(') ||
      content.includes('.safeParse(') ||
      content.includes('.validate(');

    if (hasPOST && hasValidation) {
      validatedRoutes++;
    } else if (hasPOST && !hasValidation) {
      unvalidatedRoutes.push(path.relative(dir, file));
    }
  }

  if (unvalidatedRoutes.length === 0) {
    results.push({ status: 'pass', message: 'Input validation (Zod/Yup) found on POST routes' });
  } else {
    results.push({
      status: 'warn',
      message: `${unvalidatedRoutes.length} POST route${unvalidatedRoutes.length > 1 ? 's' : ''} missing input validation`,
    });
    for (const route of unvalidatedRoutes.slice(0, 2)) {
      results.push({ status: 'warn', message: 'No input validation detected', file: route });
    }
  }

  const allFiles = await glob(`${dir}/src/**/*.ts`, { ignore: ['**/node_modules/**'] });
  const hasRateLimit = allFiles.some(file => {
    const content = fs.readFileSync(file, 'utf-8');
    return (
      content.includes('ratelimit') ||
      content.includes('rate-limit') ||
      content.includes('upstash') ||
      content.includes('redis') ||
      content.includes('limiter')
    );
  });

  results.push(
    hasRateLimit
      ? { status: 'pass', message: 'Rate limiting detected' }
      : { status: 'warn', message: 'No rate limiting found \u2014 your API is open to abuse' }
  );

  return results;
}
