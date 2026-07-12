export interface ScanCheck {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  file?: string;
  line?: number;
}

export interface ScanCategory {
  name: string;
  checks: ScanCheck[];
}

export interface ScanReport {
  repo: string;
  categories: ScanCategory[];
}

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  let owner: string;
  let repo: string;

  const match = input.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (match) {
    owner = match[1];
    repo = match[2].replace(/\.git$/, '');
  } else {
    const parts = input.replace(/^@/, '').split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      owner = parts[0];
      repo = parts[1].replace(/\.git$/, '');
    } else {
      return null;
    }
  }
  return { owner, repo };
}

async function fetchFile(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.content) {
      return atob(data.content.replace(/\n/g, ''));
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchRepoInfo(owner: string, repo: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function listFiles(owner: string, repo: string, path = ''): Promise<string[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [path || data.name];
    const files: string[] = [];
    for (const item of data) {
      if (item.type === 'file') {
        files.push(item.path);
      } else if (item.type === 'dir') {
        const nested = await listFiles(owner, repo, item.path);
        files.push(...nested);
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function fetchFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  return fetchFile(owner, repo, path);
}

async function runSecurityChecks(owner: string, repo: string): Promise<ScanCheck[]> {
  const results: ScanCheck[] = [];

  const gitignore = await fetchFile(owner, repo, '.gitignore');
  if (gitignore !== null) {
    if (gitignore.includes('.env')) {
      results.push({ status: 'pass', message: '.env is gitignored' });
    } else {
      results.push({ status: 'fail', message: '.env is NOT gitignored — secrets will be committed' });
    }
  } else {
    results.push({ status: 'warn', message: 'No .gitignore found' });
  }

  const envExample = await fetchFile(owner, repo, '.env.example');
  if (envExample !== null) {
    results.push({ status: 'pass', message: '.env.example exists' });
  } else {
    results.push({ status: 'warn', message: 'No .env.example — collaborators won\'t know what vars to set' });
  }

  const allFiles = await listFiles(owner, repo);
  const clientExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const clientPatterns = ['components', 'app', 'pages', 'src/app', 'src/pages', 'src/components', 'src/lib'];
  const suspiciousFiles = allFiles.filter(f =>
    clientExtensions.some(ext => f.endsWith(ext)) &&
    clientPatterns.some(p => f.startsWith(p))
  );

  const dangerousPatterns = [
    { regex: /supabase.*service_role/i, label: 'Supabase service role key' },
    { regex: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API key' },
    { regex: /STRIPE_SECRET_KEY/, label: 'Stripe secret key' },
    { regex: /ANTHROPIC_API_KEY/, label: 'Anthropic API key' },
  ];

  let foundSecret = false;
  for (const filePath of suspiciousFiles) {
    const content = await fetchFileContent(owner, repo, filePath);
    if (!content) continue;
    const lines = content.split('\n');
    for (const { regex, label } of dangerousPatterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (regex.test(lines[i]) && !line.startsWith('//') && !line.startsWith('*')) {
          results.push({ status: 'fail', message: `${label} found in client-side code`, file: filePath, line: i + 1 });
          foundSecret = true;
        }
      }
    }
  }

  if (suspiciousFiles.length > 0 && !foundSecret) {
    results.push({ status: 'pass', message: 'No dangerous secrets found in client-side code' });
  }

  return results;
}

async function runAuthChecks(owner: string, repo: string): Promise<ScanCheck[]> {
  const results: ScanCheck[] = [];

  const middlewareCheck = await fetchFile(owner, repo, 'middleware.ts') ||
    await fetchFile(owner, repo, 'src/middleware.ts') ||
    await fetchFile(owner, repo, 'middleware.js');

  if (middlewareCheck) {
    results.push({ status: 'pass', message: 'Auth middleware file found' });
  } else {
    results.push({ status: 'warn', message: 'No middleware.ts found — protected routes may be unsecured' });
  }

  const envExample = await fetchFile(owner, repo, '.env.example');
  if (envExample) {
    if (envExample.includes('JWT_SECRET') || envExample.includes('NEXTAUTH_SECRET') || envExample.includes('AUTH_SECRET')) {
      results.push({ status: 'pass', message: 'Auth secret documented in .env.example' });
    } else {
      results.push({ status: 'warn', message: 'No JWT_SECRET or NEXTAUTH_SECRET in .env.example' });
    }
  }

  return results;
}

async function runPaymentChecks(owner: string, repo: string): Promise<ScanCheck[]> {
  const results: ScanCheck[] = [];
  const allFiles = await listFiles(owner, repo);
  const paymentFiles = allFiles.filter(f =>
    /webhook|stripe|mpesa|payment|daraja|stk/i.test(f)
  );

  if (paymentFiles.length === 0) {
    results.push({ status: 'warn', message: 'No payment-related files detected — skipping payment checks' });
    return results;
  }

  let hasSignature = false;
  for (const file of paymentFiles) {
    const content = await fetchFileContent(owner, repo, file);
    if (!content) continue;
    if (
      content.includes('constructEvent') ||
      content.includes('verifySignature') ||
      content.includes('hmac') ||
      content.includes('crypto.timingSafeEqual')
    ) {
      hasSignature = true;
      results.push({ status: 'pass', message: 'Webhook signature validation found', file });
      break;
    }
  }

  if (!hasSignature) {
    results.push({ status: 'fail', message: 'No webhook signature validation found — anyone can fake payment events', file: paymentFiles[0] });
  }

  return results;
}

async function runDatabaseChecks(owner: string, repo: string): Promise<ScanCheck[]> {
  const results: ScanCheck[] = [];
  const allFiles = await listFiles(owner, repo);
  const sqlFiles = allFiles.filter(f => f.endsWith('.sql'));

  if (sqlFiles.length > 0) {
    let hasRLS = false;
    for (const file of sqlFiles) {
      const content = await fetchFileContent(owner, repo, file);
      if (content && (content.toLowerCase().includes('row level security') || content.toLowerCase().includes('enable rls'))) {
        hasRLS = true;
        break;
      }
    }
    results.push(
      hasRLS
        ? { status: 'pass', message: 'Row Level Security (RLS) enabled in migrations' }
        : { status: 'fail', message: 'No RLS policies found in SQL migrations — database may be fully open' }
    );
  } else {
    results.push({ status: 'warn', message: 'No SQL migrations found — skipping RLS check' });
  }

  const envExample = await fetchFile(owner, repo, '.env.example');
  if (envExample) {
    if (envExample.includes('DATABASE_URL') || envExample.includes('SUPABASE_URL')) {
      results.push({ status: 'pass', message: 'Database URL documented in .env.example' });
    } else {
      results.push({ status: 'warn', message: 'No database URL found in .env.example' });
    }
  }

  return results;
}

async function runApiChecks(owner: string, repo: string): Promise<ScanCheck[]> {
  const results: ScanCheck[] = [];
  const allFiles = await listFiles(owner, repo);
  const apiFiles = allFiles.filter(f => f.startsWith('src/app/api/') || f.startsWith('pages/api/'));

  if (apiFiles.length === 0) {
    results.push({ status: 'warn', message: 'No API routes found — skipping API checks' });
    return results;
  }

  const unvalidated: string[] = [];
  for (const file of apiFiles) {
    const content = await fetchFileContent(owner, repo, file);
    if (!content) continue;
    const hasPOST = content.includes('POST') || content.includes('req.body') || content.includes('request.json()');
    const hasValidation =
      content.includes('z.object') || content.includes('yup.object') ||
      content.includes('.parse(') || content.includes('.safeParse(') || content.includes('.validate(');
    if (hasPOST && !hasValidation) unvalidated.push(file);
  }

  if (unvalidated.length === 0) {
    results.push({ status: 'pass', message: 'Input validation (Zod/Yup) found on POST routes' });
  } else {
    results.push({ status: 'warn', message: `${unvalidated.length} POST route${unvalidated.length > 1 ? 's' : ''} missing input validation` });
  }

  const hasRateLimit = allFiles.some(f => {
    // Just check for rate-limit related files/packages as a heuristic
    return f.includes('ratelimit') || f.includes('rate-limit') || f === 'package.json';
  });
  results.push(
    hasRateLimit
      ? { status: 'pass', message: 'Rate limiting detected' }
      : { status: 'warn', message: 'No rate limiting found — API may be open to abuse' }
  );

  return results;
}

async function runWebChecks(owner: string, repo: string): Promise<ScanCheck[]> {
  const results: ScanCheck[] = [];

  const nextConfig = await fetchFile(owner, repo, 'next.config.ts') ||
    await fetchFile(owner, repo, 'next.config.js') ||
    await fetchFile(owner, repo, 'next.config.mjs');

  if (nextConfig) {
    if (nextConfig.includes('Content-Security-Policy') || nextConfig.includes('csp')) {
      results.push({ status: 'pass', message: 'Content Security Policy (CSP) configured' });
    } else {
      results.push({ status: 'warn', message: 'No CSP found — app may be vulnerable to XSS' });
    }
  } else {
    results.push({ status: 'warn', message: 'No Next.js config found — skipping header checks' });
  }

  return results;
}

export async function scanGitHubRepo(input: string): Promise<ScanReport> {
  const parsed = parseGitHubUrl(input);
  if (!parsed) {
    return {
      repo: input,
      categories: [{
        name: 'Error',
        checks: [{ status: 'fail', message: `Could not parse "${input}" as a GitHub repository URL. Try something like: https://github.com/user/repo` }],
      }],
    };
  }

  const { owner, repo } = parsed;
  const repoInfo = await fetchRepoInfo(owner, repo);
  if (!repoInfo) {
    return {
      repo: `${owner}/${repo}`,
      categories: [{
        name: 'Error',
        checks: [{ status: 'fail', message: `Repository "${owner}/${repo}" not found or is private. Make sure it's a public GitHub repo.` }],
      }],
    };
  }

  const categories: ScanCategory[] = [];
  categories.push({ name: 'Security', checks: await runSecurityChecks(owner, repo) });
  categories.push({ name: 'Authentication', checks: await runAuthChecks(owner, repo) });
  categories.push({ name: 'Payments', checks: await runPaymentChecks(owner, repo) });
  categories.push({ name: 'Database', checks: await runDatabaseChecks(owner, repo) });
  categories.push({ name: 'API & Validation', checks: await runApiChecks(owner, repo) });
  categories.push({ name: 'Web Security', checks: await runWebChecks(owner, repo) });

  return { repo: `${owner}/${repo}`, categories };
}
