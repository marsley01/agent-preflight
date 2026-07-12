import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

const DANGEROUS_PATTERNS = [
  { pattern: /supabase.*service_role/i, label: 'Supabase service role key' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/,     label: 'OpenAI API key' },
  { pattern: /STRIPE_SECRET_KEY/,        label: 'Stripe secret key' },
  { pattern: /ANTHROPIC_API_KEY/,        label: 'Anthropic API key' },
  { pattern: /Consumer_Secret/i,         label: 'M-Pesa consumer secret' },
];

const CLIENT_SIDE_DIRS = ['components', 'app', 'pages', 'src/app', 'src/pages', 'src/components', 'src/lib'];

export async function runSecurityChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const gitignorePath = path.join(dir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (gitignore.includes('.env')) {
      results.push({ status: 'pass', message: '.env is gitignored' });
    } else {
      results.push({ status: 'fail', message: '.env is NOT gitignored \u2014 your secrets will be committed' });
    }
  } else {
    results.push({ status: 'warn', message: 'No .gitignore found' });
  }

  const envExamplePath = path.join(dir, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    results.push({ status: 'pass', message: '.env.example exists' });
  } else {
    results.push({ status: 'warn', message: 'No .env.example \u2014 collaborators won\'t know what vars to set' });
  }

  const clientFiles: string[] = [];
  for (const clientDir of CLIENT_SIDE_DIRS) {
    const fullDir = path.join(dir, clientDir);
    if (fs.existsSync(fullDir)) {
      const files = await glob(`${fullDir}/**/*.{ts,tsx,js,jsx}`, { ignore: ['**/node_modules/**'] });
      clientFiles.push(...files);
    }
  }

  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (const { pattern, label } of DANGEROUS_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i]) && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('*')) {
          const relativePath = path.relative(dir, file);
          results.push({
            status: 'fail',
            message: `${label} found in client-side code`,
            file: relativePath,
            line: i + 1,
          });
        }
      }
    }
  }

  if (clientFiles.length > 0 && !results.some(r => r.status === 'fail' && r.message.includes('found in client-side'))) {
    results.push({ status: 'pass', message: 'No dangerous secrets found in client-side code' });
  }

  return results;
}
