import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

export async function runGraphqlChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const gqlFiles = await glob(`${dir}/**/*.{graphql,gql}`, { ignore: ['**/node_modules/**'] });
  const gqlTsFiles = await glob(`${dir}/src/**/*.ts`, { ignore: ['**/node_modules/**'] });

  const allGqlFiles = [...gqlFiles, ...gqlTsFiles.filter(f => {
    const content = fs.readFileSync(f, 'utf-8');
    return content.includes('graphql') || content.includes('GraphQL') || content.includes('gql`') || content.includes('apollo') || content.includes('urql');
  })];

  if (allGqlFiles.length === 0) {
    results.push({ status: 'warn', message: 'No GraphQL files detected \u2014 skipping GraphQL checks' });
    return results;
  }

  let hasDepthLimit = false;
  let depthFile: string | undefined;

  for (const file of allGqlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (
      content.includes('depthLimit') ||
      content.includes('queryDepth') ||
      content.includes('maxDepth') ||
      content.includes('validationRules') ||
      content.includes('complexity')
    ) {
      hasDepthLimit = true;
      depthFile = path.relative(dir, file);
      break;
    }
  }

  if (hasDepthLimit) {
    results.push({ status: 'pass', message: 'GraphQL query depth limiting found', file: depthFile });
  } else {
    results.push({ status: 'warn', message: 'No GraphQL depth limiting found \u2014 malicious queries can exhaust your server' });
  }

  let hasAuth = false;
  let authFile: string | undefined;

  for (const file of allGqlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (
      content.includes('context') && (
        content.includes('token') ||
        content.includes('auth') ||
        content.includes('session') ||
        content.includes('bearer')
      )
    ) {
      hasAuth = true;
      authFile = path.relative(dir, file);
      break;
    }
  }

  if (hasAuth) {
    results.push({ status: 'pass', message: 'GraphQL authentication context found', file: authFile });
  } else {
    results.push({ status: 'warn', message: 'No GraphQL auth context detected \u2014 your GraphQL endpoint may be public' });
  }

  let introspectionDisabled = false;
  for (const file of allGqlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('introspection') && (content.includes('false') || content.includes('disabled') || content.includes('0'))) {
      introspectionDisabled = true;
      break;
    }
  }

  results.push(
    introspectionDisabled
      ? { status: 'pass', message: 'GraphQL introspection disabled in production' }
      : { status: 'warn', message: 'GraphQL introspection may be enabled \u2014 attackers can discover your entire schema' }
  );

  return results;
}
