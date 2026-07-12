import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

export async function runWebChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const nextConfigPaths = [
    path.join(dir, 'next.config.ts'),
    path.join(dir, 'next.config.js'),
    path.join(dir, 'next.config.mjs'),
  ];

  const existingConfigs = nextConfigPaths.filter(fs.existsSync);

  if (existingConfigs.length > 0) {
    const content = fs.readFileSync(existingConfigs[0], 'utf-8');
    const hasCSP = content.includes('Content-Security-Policy') || content.includes('csp');
    const hasFrameOptions = content.includes('X-Frame-Options') || content.includes('frame-ancestors');
    const hasCORS = content.includes('cors') || content.includes('CORS') || content.includes('Access-Control');

    if (hasCSP) {
      results.push({ status: 'pass', message: 'Content Security Policy (CSP) configured', file: path.relative(dir, existingConfigs[0]) });
    } else {
      results.push({ status: 'warn', message: 'No Content Security Policy (CSP) found \u2014 your app is vulnerable to XSS' });
    }

    if (hasFrameOptions) {
      results.push({ status: 'pass', message: 'Clickjacking protection found (X-Frame-Options / frame-ancestors)' });
    } else {
      results.push({ status: 'warn', message: 'No clickjacking protection \u2014 your app can be embedded in iframes' });
    }

    if (hasCORS) {
      results.push({ status: 'pass', message: 'CORS configuration detected' });
    } else {
      results.push({ status: 'warn', message: 'No explicit CORS configuration found' });
    }
  } else {
    results.push({ status: 'warn', message: 'No Next.js config found \u2014 skipping security header checks' });
  }

  const cookieFiles = await glob(`${dir}/**/*.ts`, { ignore: ['**/node_modules/**', '**/.next/**'] });
  let hasSecureCookies = false;
  let cookieFile: string | undefined;

  for (const file of cookieFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const hasCookie = content.includes('cookie') || content.includes('Cookie') || content.includes('cookies');
    if (hasCookie && (content.includes('httpOnly') || content.includes('secure') || content.includes('sameSite'))) {
      hasSecureCookies = true;
      cookieFile = path.relative(dir, file);
      break;
    }
  }

  results.push(
    hasSecureCookies
      ? { status: 'pass', message: 'Cookie security flags (httpOnly/secure/sameSite) detected', file: cookieFile }
      : { status: 'warn', message: 'No secure cookie flags detected \u2014 cookies may be accessible to JavaScript' }
  );

  return results;
}
