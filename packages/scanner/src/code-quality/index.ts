import type { Finding, ScannerResult } from "../types";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

function walkFiles(dir: string, ext: string[] = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro"]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".next" && entry.name !== "build") {
        results.push(...walkFiles(full, ext));
      } else if (entry.isFile() && ext.some((e) => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

export function codeQualityScanner(projectRoot: string): ScannerResult {
  const findings: Finding[] = [];
  const start = Date.now();

  const sourceFiles = walkFiles(projectRoot);
  const pkgPath = join(projectRoot, "package.json");
  let pkgDeps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    for (const [k, v] of Object.entries(deps)) pkgDeps[k] = v as string;
    for (const [k, v] of Object.entries(devDeps)) pkgDeps[k] = v as string;
  } catch {}

  const usedDeps: Set<string> = new Set();
  for (const f of sourceFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      for (const dep of Object.keys(pkgDeps)) {
        const importName = dep.startsWith("@") ? dep.split("/").slice(0, 2).join("/") : dep.split("/")[0];
        const patterns = [
          `require('${importName}'`,
          `require("${importName}"`,
          `from '${importName}'`,
          `from "${importName}"`,
          `from '${importName}/`,
          `from "${importName}/`,
          `import('${importName}'`,
          `import("${importName}"`,
        ];
        if (patterns.some((p) => content.includes(p))) {
          usedDeps.add(dep);
        }
      }
    } catch {}
  }

  const allDeps = Object.keys(pkgDeps);
  const unused = allDeps.filter((d) => !usedDeps.has(d) && !d.startsWith("@types/") && !d.startsWith("typescript") && d !== "next" && d !== "react" && d !== "react-dom" && d !== "vite" && d !== "eslint");
  if (unused.length > 0) {
    findings.push({
      id: "CQ-001",
      title: `${unused.length} potentially unused dependenc${unused.length === 1 ? "y" : "ies"}`,
      description: `Could not find imports for: ${unused.join(", ")}`,
      severity: "medium",
      category: "code-quality",
      file: "package.json",
      impact: "Unused dependencies increase bundle size and attack surface.",
      suggestion: `Remove unused dependencies: ${unused.join(", ")}`,
      effort: "low",
      risk: "low",
    });
  }

  const largeFiles: [string, number][] = [];
  for (const f of sourceFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      const lines = content.split("\n").length;
      if (lines > 400) {
        largeFiles.push([relative(projectRoot, f), lines]);
      }
    } catch {}
  }
  if (largeFiles.length > 0) {
    const worst = largeFiles.sort((a, b) => b[1] - a[1])[0]!;
    findings.push({
      id: "CQ-002",
      title: `Large files detected (${largeFiles.length})`,
      description: `Largest file is ${worst[0]} at ${worst[1]} lines.`,
      severity: "medium",
      category: "code-quality",
      file: worst[0],
      impact: "Large files indicate poor separation of concerns.",
      suggestion: "Break down large files into smaller modules.",
      effort: "medium",
      risk: "low",
      confidence: 0.9,
    });
  }

  let todoCount = 0;
  let fixmeCount = 0;
  for (const f of sourceFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      todoCount += (content.match(/(?:\/\/|#|<!--)\s*TODO/gi) || []).length;
      fixmeCount += (content.match(/(?:\/\/|#|<!--)\s*FIXME/gi) || []).length;
    } catch {}
  }
  if (todoCount > 5) {
    findings.push({
      id: "CQ-003",
      title: `High number of TODO comments (${todoCount})`,
      description: `${todoCount} TODO comments found across the codebase.`,
      severity: "low",
      category: "code-quality",
      impact: "Unresolved TODOs indicate incomplete work.",
      suggestion: "Review and resolve TODO comments before production deployment.",
      effort: "medium",
      risk: "low",
    });
  }
  if (fixmeCount > 0) {
    findings.push({
      id: "CQ-004",
      title: `FIXME comments found (${fixmeCount})`,
      description: `${fixmeCount} FIXME comments indicate known bugs or issues.`,
      severity: "high",
      category: "code-quality",
      impact: "FIXME comments represent known problems that need resolution.",
      suggestion: "Address all FIXME comments before deployment.",
      effort: "medium",
      risk: "medium",
    });
  }

  let consoleCount = 0;
  for (const f of sourceFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      consoleCount += (content.match(/(?:console\.log|console\.warn|console\.error)\s*\(/g) || []).length;
    } catch {}
  }
  if (consoleCount > 5) {
    findings.push({
      id: "CQ-005",
      title: `High console.log usage (${consoleCount} occurrences)`,
      description: "Excessive console logging indicates debug code still in the codebase.",
      severity: "low",
      category: "code-quality",
      impact: "Console logs can leak information in production.",
      suggestion: "Remove or replace console.log with a proper logging library.",
      effort: "low",
      risk: "low",
    });
  }

  let emptyFiles: [string, number][] = [];
  for (const f of sourceFiles) {
    try {
      const stats = statSync(f);
      if (stats.size === 0) {
        emptyFiles.push([relative(projectRoot, f), 0]);
      }
    } catch {}
  }
  if (emptyFiles.length > 0) {
    const emptyList = emptyFiles.map(([name]) => name).join(", ");
    findings.push({
      id: "CQ-006",
      title: `Empty files found (${emptyFiles.length})`,
      description: `Empty files detected: ${emptyList}`,
      severity: "low",
      category: "code-quality",
      file: emptyFiles[0]![0],
      impact: "Empty files clutter the codebase.",
      suggestion: "Remove or populate empty files.",
      effort: "low",
      risk: "low",
    });
  }

  return { scanner: "Code Quality Scanner", category: "code-quality", findings, durationMs: Date.now() - start };
}