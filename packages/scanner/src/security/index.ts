import type { Finding, ScannerResult } from "../types";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

function walkFiles(dir: string, ext: string[] = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro"]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".next") {
        results.push(...walkFiles(full, ext));
      } else if (entry.isFile() && ext.some((e) => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

export function securityScanner(projectRoot: string): ScannerResult {
  const findings: Finding[] = [];
  const start = Date.now();

  const envPath = join(projectRoot, ".env");
  const pkgPath = join(projectRoot, "package.json");
  let envContent = "";
  let pkg: any = {};
  let allDeps: Record<string, string> = {};

  try {
    envContent = readFileSync(envPath, "utf-8");
  } catch {}
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch {}

  if (envContent) {
    const secretPatterns = [
      /(?:SK|KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIALS|API_KEY|ACCESS_KEY)[\s]*[:=][\s]*['"][A-Za-z0-9_\-]{16,}['"]/gi,
    ];
    for (const pattern of secretPatterns) {
      const matches = envContent.match(pattern);
      if (matches) {
        findings.push({
          id: "SEC-001",
          title: "Hardcoded secrets detected in .env",
          description: `${matches.length} potential secret(s) found in .env file.`,
          severity: "critical",
          category: "security",
          file: ".env",
          impact: "Exposed credentials can lead to account takeover and data breaches.",
          suggestion: "Never commit .env files. Ensure .env is in .gitignore. Use a secrets manager.",
          references: ["https://owasp.org/www-community/Secrets_Management_Cheat_Sheet"],
          score: 95,
          confidence: 0.9,
          effort: "low",
          risk: "high",
        });
        break;
      }
    }
  }

  const gitignorePath = join(projectRoot, ".gitignore");
  let hasEnvInGitignore = false;
  try {
    const gi = readFileSync(gitignorePath, "utf-8");
    hasEnvInGitignore = /\n\.env\b/.test("\n" + gi);
  } catch {}
  if (!hasEnvInGitignore) {
    findings.push({
      id: "SEC-002",
      title: ".env not in .gitignore",
      description: "The .gitignore file does not contain a rule to exclude .env files.",
      severity: "high",
      category: "security",
      file: ".gitignore",
      impact: "Environment files containing secrets may be accidentally committed.",
      suggestion: "Add '.env' to your .gitignore file to prevent leaking secrets.",
      effort: "low",
      risk: "high",
    });
  }

  const hasAudit = (pkg?.scripts?.audit as string) || (pkg?.scripts?.["security-audit"] as string);
  if (!hasAudit) {
    findings.push({
      id: "SEC-003",
      title: "No security audit script configured",
      description: "package.json does not include a security audit script (e.g., 'npm audit').",
      severity: "low",
      category: "security",
      file: "package.json",
      impact: "Vulnerable dependencies may go unnoticed without automated auditing.",
      suggestion: "Add a script: 'security-audit': 'npm audit' and run it in CI.",
      effort: "low",
      risk: "medium",
    });
  }

  const riskyDeps = ["nth-check", "glob-parent", "trim", "ansi-regex"];
  for (const dep of riskyDeps) {
    if (allDeps[dep]) {
      findings.push({
        id: `SEC-004-${dep}`,
        title: `Potentially vulnerable dependency: ${dep}`,
        description: `Known security vulnerabilities have been reported for ${dep}.`,
        severity: "high",
        category: "security",
        file: "package.json",
        impact: "Unpatched dependencies can be exploited by attackers.",
        suggestion: `Run 'npm audit' to check the current state of ${dep} and update if needed.`,
        effort: "low",
        risk: "high",
      });
    }
  }

  const sourceFiles = walkFiles(projectRoot);
  let hasCSP = false;
  for (const f of sourceFiles.slice(0, 50)) {
    try {
      const content = readFileSync(f, "utf-8");
      if (/content-security-policy|helmet\.csp|CSP/i.test(content)) {
        hasCSP = true;
        break;
      }
    } catch {}
  }
  if (!hasCSP) {
    findings.push({
      id: "SEC-005",
      title: "No Content Security Policy found",
      description: "Could not detect CSP headers or helmet middleware in the source code.",
      severity: "high",
      category: "security",
      impact: "Missing CSP makes your app vulnerable to XSS and data injection attacks.",
      suggestion: "Implement CSP headers via helmet (Node.js) or meta tags. Use strict policies.",
      references: ["https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"],
      confidence: 0.7,
      effort: "medium",
      risk: "high",
    });
  }

  const patterns = [
    { id: "SEC-006", title: "Potential SQL injection", severity: "critical" as const, pattern: /(?:execute|query|raw)\s*\(\s*[`'"]\s*(?:SELECT|INSERT|UPDATE|DELETE)\s/i },
    { id: "SEC-007", title: "Potential XSS vulnerability", severity: "high" as const, pattern: /(?:dangerouslySetInnerHTML|innerHTML|v-html)\s*=/gi },
    { id: "SEC-008", title: "Potential command injection", severity: "critical" as const, pattern: /(?:exec|execSync|spawn|execFile)\s*\(\s*[`'"]/i },
  ];

  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const relPath = relative(projectRoot, file);
      for (const p of patterns) {
        const match = content.match(p.pattern);
        if (match) {
          findings.push({
            id: p.id,
            title: p.title,
            description: "Found pattern in file.",
            severity: p.severity,
            category: "security",
            file: relPath,
            impact: p.title === "Potential SQL injection" ? "Attackers can read, modify, or delete database data."
              : "Attackers can execute arbitrary code or scripts.",
            suggestion: p.title === "Potential SQL injection" ? "Use parameterized queries or an ORM."
              : "Sanitize all user input and avoid using dangerous methods with untrusted data.",
            confidence: 0.5,
            effort: "medium",
            risk: "high",
          });
        }
      }
    } catch {}
  }

  return { scanner: "Security Scanner", category: "security", findings, durationMs: Date.now() - start };
}