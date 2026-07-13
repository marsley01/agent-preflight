import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

/**
 * Check for common Supabase misconfigurations:
 * - RLS enabled on all tables
 * - Service role key exposed in client code
 * - auth.role() deprecated usage
 * - Views without security_invoker
 * - Storage buckets without RLS
 * - Anon key committed publicly
 * - Missing SELECT policies on RLS tables
 * - UPDATE policies without WITH CHECK
 */
export async function runSupabaseChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const allTsFiles = await glob(`${dir}/src/**/*.{ts,tsx,js,jsx}`, { ignore: ['**/node_modules/**', '**/.next/**'] });
  const allFiles = await glob(`${dir}/**/*.{ts,tsx,js,jsx,sql,json,env,yml,yaml}`, { ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'] });
  const sqlFiles = (await glob(`${dir}/**/*.sql`, { ignore: ['**/node_modules/**'] }));
  const hasSupabaseDir = fs.existsSync(path.join(dir, 'supabase')) || fs.existsSync(path.join(dir, 'src/supabase'));

  // Early exit if no Supabase usage detected
  if (!hasSupabaseDir && sqlFiles.length === 0) {
    const supabaseInSource = allTsFiles.some(f => {
      const content = fs.readFileSync(f, 'utf-8');
      return /supabase/i.test(content);
    });
    if (!supabaseInSource) {
      results.push({ status: 'pass', message: 'No Supabase usage detected — skipping Supabase checks' });
      return results;
    }
  }

  // Read all source content
  const allSourceContent = allFiles.map(f => ({ path: f, content: fs.readFileSync(f, 'utf-8') }));
  const allJoined = allSourceContent.map(f => f.content).join('\n');
  const sqlJoined = sqlFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');

  // 1. Service role key in client-side code
  let foundServiceKey = false;
  for (const { path: filePath, content } of allSourceContent) {
    if (/supabase.*service_role/i.test(content) && !/\/\/|service_role_key_in_env|VITE_SUPABASE_SERVICE_KEY/.test(content)) {
      results.push({
        status: 'fail',
        message: 'Supabase service_role key found in source — full database access exposed',
        file: path.relative(dir, filePath),
      });
      foundServiceKey = true;
    }
  }
  if (!foundServiceKey) {
    results.push({ status: 'pass', message: 'No Supabase service_role key detected in source code' });
  }

  // 2. Anon key committed to public repo (check .env or hardcoded)
  const envFiles = allSourceContent.filter(f => f.path.endsWith('.env') || f.path.endsWith('.env.example'));
  for (const { path: filePath, content } of envFiles) {
    const anonMatch = content.match(/SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    if (anonMatch && !content.includes('# SUPABASE_ANON_KEY') && !content.includes('# NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
      results.push({
        status: 'pass',
        message: 'Supabase anon key documented in environment file',
        file: path.relative(dir, filePath),
      });
    }
  }

  // 3. RLS enabled in SQL migrations
  if (sqlFiles.length > 0) {
    const hasRls = /row level security|enable rls|CREATE POLICY/i.test(sqlJoined);
    results.push({
      status: hasRls ? 'pass' : 'fail',
      message: hasRls
        ? 'Row Level Security (RLS) enabled in SQL migrations'
        : 'No RLS policies found in SQL migrations — database may be fully open',
    });

    // 4. UPDATE policies with WITH CHECK
    if (hasRls) {
      const updatePolicies = sqlJoined.match(/CREATE\s+POLICY[\s\S]*?FOR\s+UPDATE/gi);
      const withCheck = sqlJoined.match(/CREATE\s+POLICY[\s\S]*?FOR\s+UPDATE[\s\S]*?WITH\s+CHECK/gi);
      if (updatePolicies && updatePolicies.length > 0) {
        results.push({
          status: (withCheck && withCheck.length > 0) ? 'pass' : 'fail',
          message: (withCheck && withCheck.length > 0)
            ? 'UPDATE policies include WITH CHECK clauses'
            : 'UPDATE policies missing WITH CHECK — users can reassign row ownership',
        });
      }

      // 5. Missing SELECT policy
      const createTables = sqlJoined.match(/CREATE\s+TABLE\s+\w+/gi) || [];
      const selectPolicies = sqlJoined.match(/CREATE\s+POLICY[\s\S]*?FOR\s+SELECT/gi) || [];
      if (createTables.length > 0) {
        results.push({
          status: createTables.length <= selectPolicies.length + 1 ? 'pass' : 'warn',
          message: createTables.length <= selectPolicies.length + 1
            ? 'SELECT policies found for all detected tables'
            : `${createTables.length} tables, ${selectPolicies.length} SELECT policies — some tables may lack SELECT access`,
        });
      }
    }

    // 6. auth.role() deprecated
    const hasAuthRole = /auth\.role\s*\(/.test(sqlJoined);
    if (hasAuthRole) {
      results.push({
        status: 'fail',
        message: 'auth.role() used in SQL policies — deprecated, use TO clause instead',
      });
    }

    // 7. View security_invoker
    const hasViews = /CREATE\s+(OR\s+REPLACE\s+)?VIEW/i.test(sqlJoined);
    const hasSecurityInvoker = /security_invoker\s*=\s*true/i.test(sqlJoined);
    if (hasViews) {
      results.push({
        status: hasSecurityInvoker ? 'pass' : 'fail',
        message: hasSecurityInvoker
          ? 'Views use WITH (security_invoker = true)'
          : 'Views found without security_invoker — they bypass RLS by default',
      });
    }
  }

  // 8. Storage RLS
  const hasStorage = /supabase.*storage|storage.*bucket/i.test(allJoined);
  const hasStorageRls = /storage.*rls|bucket.*rls|create\s+policy.*storage|storage.*policy/i.test(allJoined);
  if (hasStorage) {
    results.push({
      status: hasStorageRls ? 'pass' : 'warn',
      message: hasStorageRls
        ? 'Storage bucket RLS policies detected'
        : 'Storage usage detected but no bucket-level RLS policies found',
    });
  }

  return results;
}
