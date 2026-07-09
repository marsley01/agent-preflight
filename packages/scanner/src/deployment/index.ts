import type { Finding, ScannerResult } from "../types";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function deploymentScanner(projectRoot: string): ScannerResult {
  const findings: Finding[] = [];
  const start = Date.now();

  const pkgPath = join(projectRoot, "package.json");
  let pkg: any = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {}

  const hasBuild = pkg?.scripts?.build;
  if (!hasBuild) {
    findings.push({
      id: "DEP-001",
      title: "No build script configured",
      description: "package.json does not contain a 'build' script.",
      severity: "critical",
      category: "deployment",
      file: "package.json",
      impact: "Cannot generate a production build for deployment.",
      suggestion: "Add a build script to package.json (e.g., 'build': 'next build' or 'vite build').",
      effort: "low",
      risk: "high",
    });
  }

  const hasStart = pkg?.scripts?.start;
  if (!hasStart) {
    findings.push({
      id: "DEP-002",
      title: "No start script configured",
      description: "package.json does not contain a 'start' script.",
      severity: "high",
      category: "deployment",
      file: "package.json",
      impact: "Cannot start the production server after deployment.",
      suggestion: "Add a start script (e.g., 'start': 'next start' or 'node server.js').",
      effort: "low",
      risk: "high",
    });
  }

  const hasDockerfile = existsSync(join(projectRoot, "Dockerfile"));
  const hasCompose = existsSync(join(projectRoot, "docker-compose.yml")) || existsSync(join(projectRoot, "docker-compose.yaml"));
  if (!hasDockerfile && !hasCompose) {
    findings.push({
      id: "DEP-003",
      title: "No Docker configuration found",
      description: "No Dockerfile or docker-compose.yml detected in the project root.",
      severity: "medium",
      category: "deployment",
      impact: "Containerization helps ensure consistent deployments across environments.",
      suggestion: "Create a Dockerfile to containerize your application for consistent deployments.",
      effort: "medium",
      risk: "medium",
    });
  }

  const hasEnvExample = existsSync(join(projectRoot, ".env.example"));
  if (!hasEnvExample) {
    findings.push({
      id: "DEP-004",
      title: "No .env.example file found",
      description: "Missing .env.example which documents required environment variables.",
      severity: "medium",
      category: "deployment",
      impact: "New team members and deployment pipelines may not know which environment variables are required.",
      suggestion: "Create a .env.example file listing all required environment variables without secrets.",
      effort: "low",
      risk: "low",
    });
  }

  let hasCI = false;
  if (existsSync(join(projectRoot, ".github", "workflows"))) hasCI = true;
  else if (existsSync(join(projectRoot, ".gitlab-ci.yml"))) hasCI = true;
  else if (existsSync(join(projectRoot, ".circleci", "config.yml"))) hasCI = true;
  if (!hasCI) {
    findings.push({
      id: "DEP-005",
      title: "No CI/CD configuration detected",
      description: "No CI/CD pipeline configuration was found.",
      severity: "high",
      category: "deployment",
      impact: "Without CI/CD, deployments are manual and error-prone.",
      suggestion: "Set up a CI/CD pipeline using GitHub Actions, GitLab CI, or CircleCI.",
      effort: "high",
      risk: "medium",
    });
  }

  const envFiles: string[] = [];
  try {
    const dir = readdirSync(projectRoot);
    for (const entry of dir) {
      if (entry.startsWith(".env") && entry !== ".env.example") {
        envFiles.push(entry);
      }
    }
  } catch {}
  if (envFiles.length > 0) {
    findings.push({
      id: "DEP-006",
      title: "Environment files detected in project root",
      description: `Found environment files: ${envFiles.join(", ")}. Ensure these are not committed.`,
      severity: "high",
      category: "deployment",
      impact: "Committed .env files expose secrets and credentials.",
      suggestion: "Ensure .env files are in .gitignore. Use .env.example for documentation.",
      effort: "low",
      risk: "high",
    });
  }

  return { scanner: "Deployment Scanner", category: "deployment", findings, durationMs: Date.now() - start };
}