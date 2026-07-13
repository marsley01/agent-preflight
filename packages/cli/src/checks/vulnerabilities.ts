import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

/**
 * Check for common web vulnerabilities:
 * - XSS (dangerouslySetInnerHTML, innerHTML assignments)
 * - eval() usage (arbitrary code execution)
 * - MIME sniffing protection (X-Content-Type-Options: nosniff)
 * - HSTS (Strict-Transport-Security) header
 * - Mixed content (http:// URLs in source)
 * - CSRF protection (tokens, SameSite cookies)
 * - Debug mode enabled in production
 * - Build artifacts missing from .gitignore
 */
export async function runVulnerabilityChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const allTsFiles = await glob(`${dir}/src/**/*.{ts,tsx,js,jsx}`, { ignore: ['**/node_modules/**', '**/.next/**'] });
  const allFiles = await glob(`${dir}/**/*.{ts,tsx,js,jsx,json,env,yml,yaml,config.*}`, { ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'] });

  // --- 1. XSS: dangerouslySetInnerHTML / innerHTML ---
  let hasUnsafeHTML = false;
  let unsafeHTMLFile: string | undefined;

  for (const file of allTsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('dangerouslySetInnerHTML') || content.includes('.innerHTML =')) {
      hasUnsafeHTML = true;
      unsafeHTMLFile = path.relative(dir, file);
      break;
    }
  }

  results.push(
    hasUnsafeHTML
      ? { status: 'warn', message: 'dangerouslySetInnerHTML or innerHTML assignment found \u2014 potential XSS risk', file: unsafeHTMLFile }
      : { status: 'pass', message: 'No dangerouslySetInnerHTML or innerHTML assignments found' }
  );

  // --- 2. eval() usage ---
  let hasEval = false;
  let evalFile: string | undefined;

  for (const file of allTsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/eval\s*\(/.test(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        hasEval = true;
        evalFile = path.relative(dir, file);
        break;
      }
    }
    if (hasEval) break;
  }

  results.push(
    hasEval
      ? { status: 'fail', message: 'eval() usage detected \u2014 arbitrary code execution risk', file: evalFile }
      : { status: 'pass', message: 'No eval() usage detected' }
  );

  // --- 3. Sniffing protection: X-Content-Type-Options ---
  const configFiles = [
    'next.config.ts', 'next.config.js', 'next.config.mjs',
    '.htaccess', 'nginx.conf', 'web.config',
  ];

  let hasNosniff = false;
  let nosniffFile: string | undefined;

  for (const cfg of configFiles) {
    const cfgPath = path.join(dir, cfg);
    if (fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf-8');
      if (content.includes('nosniff') || content.includes('X-Content-Type-Options')) {
        hasNosniff = true;
        nosniffFile = cfg;
        break;
      }
    }
  }

  results.push(
    hasNosniff
      ? { status: 'pass', message: 'X-Content-Type-Options: nosniff found \u2014 MIME sniffing protection enabled', file: nosniffFile }
      : { status: 'warn', message: 'No X-Content-Type-Options: nosniff found \u2014 browser may MIME-sniff responses' }
  );

  // --- 4. HSTS ---
  let hasHSTS = false;
  let hstsFile: string | undefined;

  for (const cfg of configFiles) {
    const cfgPath = path.join(dir, cfg);
    if (fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf-8');
      if (content.includes('Strict-Transport-Security') || content.includes('HSTS') || content.includes('hsts')) {
        hasHSTS = true;
        hstsFile = cfg;
        break;
      }
    }
  }

  results.push(
    hasHSTS
      ? { status: 'pass', message: 'HSTS (Strict-Transport-Security) configured', file: hstsFile }
      : { status: 'warn', message: 'No HSTS header found \u2014 users may connect over HTTP instead of HTTPS' }
  );

  // --- 5. Mixed content: http:// URLs in source ---
  let hasMixedContent = false;
  const mixedContentFiles: string[] = [];

  for (const file of allTsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const httpMatches = content.match(/https?:\/\/(?!localhost)(?!127\.0\.0\.1)(?![\w.-]*\.\w{2,}\/)[^\s"'`)*]+/g);
    if (httpMatches) {
      const insecureUrls = httpMatches.filter(u => u.startsWith('http://'));
      if (insecureUrls.length > 0) {
        hasMixedContent = true;
        mixedContentFiles.push(path.relative(dir, file));
      }
    }
  }

  results.push(
    hasMixedContent
      ? { status: 'warn', message: `http:// URLs found in ${mixedContentFiles.length} file(s) \u2014 mixed content vulnerability`, file: mixedContentFiles[0] }
      : { status: 'pass', message: 'No mixed content (http:// URLs) detected in source' }
  );

  // --- 6. CSRF protection ---
  const csrfPatterns = [
    'csrf', 'CSRF', 'csrfToken', 'xsrf', 'XSRF',
    'SameSite', 'sameSite', 'same-site',
    'doubleSubmit', 'csrfProtection',
  ];

  let hasCSRF = false;
  let csrfFile: string | undefined;

  for (const file of allTsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const pattern of csrfPatterns) {
      if (content.includes(pattern)) {
        hasCSRF = true;
        csrfFile = path.relative(dir, file);
        break;
      }
    }
    if (hasCSRF) break;
  }

  results.push(
    hasCSRF
      ? { status: 'pass', message: 'CSRF protection detected (token or SameSite cookie)', file: csrfFile }
      : { status: 'warn', message: 'No CSRF protection detected \u2014 forms and API mutations may be vulnerable to cross-site requests' }
  );

  // --- 7. Debug mode / information disclosure ---
  let hasDebugLeak = false;
  let debugFile: string | undefined;

  for (const file of allTsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        (line.includes('debug: true') || line.includes('debug = true') || line.includes('isDebug = true')) &&
        !line.trim().startsWith('//')
      ) {
        hasDebugLeak = true;
        debugFile = path.relative(dir, file);
        break;
      }
    }
    if (hasDebugLeak) break;
  }

  results.push(
    hasDebugLeak
      ? { status: 'warn', message: 'Debug mode enabled in source \u2014 may expose sensitive info in production', file: debugFile }
      : { status: 'pass', message: 'No debug mode flags detected in source' }
  );

  // --- 8. Check .gitignore for common build artifacts ---
  const gitignorePath = path.join(dir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    const expectedEntries = ['.next', 'dist', 'build', '.env.local', 'coverage', '.turbo'];
    const missing = expectedEntries.filter(e => !gitignore.includes(e));

    if (missing.length === 0) {
      results.push({ status: 'pass', message: 'All common build artifacts are gitignored (.next, dist, build, .env.local)' });
    } else {
      results.push({ status: 'warn', message: `Build artifacts not gitignored: ${missing.join(', ')} \u2014 they may leak in the repo` });
    }
  }

  return results;
}
