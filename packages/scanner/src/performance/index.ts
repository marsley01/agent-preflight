import type { Finding, ScannerResult } from "../types";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function walkFiles(dir: string, ext: string[] = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro", ".css", ".scss", ".html"]): string[] {
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

export function performanceScanner(projectRoot: string): ScannerResult {
  const findings: Finding[] = [];
  const start = Date.now();

  const sourceFiles = walkFiles(projectRoot);
  const pkgPath = join(projectRoot, "package.json");
  let pkgDeps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkgDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch {}

  const largeDeps = ["moment", "lodash", "jquery", "bootstrap", "chart.js", "fullcalendar"];
  for (const dep of largeDeps) {
    if (pkgDeps[dep]) {
      findings.push({
        id: "PERF-001",
        title: `Large dependency detected: ${dep}`,
        description: `${dep} is a relatively large library. Consider a lighter alternative.`,
        severity: "medium",
        category: "performance",
        file: "package.json",
        impact: "Large dependencies increase bundle size and slow down page loads.",
        suggestion: `Replace ${dep} with a lighter alternative.`,
        effort: "medium",
        risk: "low",
      });
    }
  }

  let hasImageOptimization = false;
  for (const f of sourceFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      if (/(?:next\/image|Image|next\/legacy\/image|\bimg\b.*loading=['"]lazy|loading="lazy")/i.test(content)) {
        hasImageOptimization = true;
        break;
      }
    } catch {}
  }
  if (!hasImageOptimization) {
    findings.push({
      id: "PERF-002",
      title: "No image optimization detected",
      description: "No lazy loading or image optimization library found.",
      severity: "medium",
      category: "performance",
      impact: "Unoptimized images increase page load times and bandwidth usage.",
      suggestion: "Use next/image, lazy loading, or a similar image optimization solution.",
      effort: "medium",
      risk: "low",
      confidence: 0.6,
    });
  }

  let hasCodeSplitting = false;
  for (const f of sourceFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      if (/(?:React\.lazy|lazy\(|Suspense|dynamic\(import|import\(\))/i.test(content)) {
        hasCodeSplitting = true;
        break;
      }
    } catch {}
  }
  if (!hasCodeSplitting) {
    findings.push({
      id: "PERF-003",
      title: "No code splitting detected",
      description: "Did not find dynamic imports or lazy loading patterns for route-level code splitting.",
      severity: "medium",
      category: "performance",
      impact: "Without code splitting, the initial bundle includes all application code.",
      suggestion: "Implement code splitting using React.lazy, dynamic imports, or Suspense.",
      effort: "medium",
      risk: "low",
      confidence: 0.5,
    });
  }

  let largeAssets: [string, number][] = [];
  for (const f of sourceFiles) {
    try {
      const stats = statSync(f);
      if (stats.size > 100_000 && !f.includes("node_modules")) {
        largeAssets.push([relative(projectRoot, f), stats.size]);
      }
    } catch {}
  }
  if (largeAssets.length > 0) {
    const sorted = largeAssets.sort((a, b) => b[1] - a[1]);
    const details = sorted.slice(0, 3).map(([name, size]) => `${name} (${(size / 1024).toFixed(0)}KB)`).join(", ");
    findings.push({
      id: "PERF-004",
      title: `Large files detected (${largeAssets.length})`,
      description: `Files over 100KB: ${details}`,
      severity: "low",
      category: "performance",
      file: sorted[0]![0],
      impact: "Large assets increase load times and bandwidth consumption.",
      suggestion: "Compress or split large files. Consider lazy loading for non-critical assets.",
      effort: "medium",
      risk: "low",
    });
  }

  return { scanner: "Performance Scanner", category: "performance", findings, durationMs: Date.now() - start };
}