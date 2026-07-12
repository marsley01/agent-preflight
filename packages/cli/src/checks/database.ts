import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

export async function runDatabaseChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const migrationFiles = await glob(`${dir}/**/*.sql`, {
    ignore: ['**/node_modules/**']
  });

  const supabaseDirs = [
    path.join(dir, 'supabase'),
    path.join(dir, 'src/supabase'),
  ];
  const hasSupabaseDir = supabaseDirs.some(fs.existsSync);

  if (hasSupabaseDir || migrationFiles.length > 0) {
    let hasRLS = false;
    for (const file of migrationFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.toLowerCase().includes('row level security') || content.toLowerCase().includes('enable rls')) {
        hasRLS = true;
        break;
      }
    }
    results.push(
      hasRLS
        ? { status: 'pass', message: 'Row Level Security (RLS) enabled in migrations' }
        : { status: 'fail', message: 'No RLS policies found in SQL migrations \u2014 your database may be fully open' }
    );
  } else {
    results.push({ status: 'warn', message: 'No SQL migrations found \u2014 skipping RLS check' });
  }

  const envExamplePath = path.join(dir, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const env = fs.readFileSync(envExamplePath, 'utf-8');
    if (env.includes('DATABASE_URL') || env.includes('SUPABASE_URL') || env.includes('NEXT_PUBLIC_SUPABASE_URL')) {
      results.push({ status: 'pass', message: 'Database URL documented in .env.example' });
    } else {
      results.push({ status: 'warn', message: 'No database URL found in .env.example' });
    }
  }

  return results;
}
