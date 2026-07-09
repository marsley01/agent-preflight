import type { CategoryScore, ScannerResult, Finding } from "./types";

export function calculateCategories(scannerResults: ScannerResult[]): CategoryScore[] {
  const categories: Record<string, { label: string; findings: Finding[] }> = {
    security: { label: "Security", findings: [] },
    "ai-safety": { label: "AI Safety", findings: [] },
    "code-quality": { label: "Code Quality", findings: [] },
    performance: { label: "Performance", findings: [] },
    deployment: { label: "Deployment", findings: [] },
  };

  for (const result of scannerResults) {
    const cat = categories[result.category];
    if (cat) {
      cat.findings.push(...result.findings);
    }
  }

  const scores: CategoryScore[] = [];

  for (const [key, val] of Object.entries(categories)) {
    const findings = val.findings;
    const total = findings.length;
    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const highCount = findings.filter((f) => f.severity === "high").length;
    const mediumCount = findings.filter((f) => f.severity === "medium").length;
    const lowCount = findings.filter((f) => f.severity === "low").length;

    let score = 100;
    score -= criticalCount * 25;
    score -= highCount * 10;
    score -= mediumCount * 5;
    score -= lowCount * 2;
    score = Math.max(0, Math.min(100, score));

    let severity: CategoryScore["severity"] = "pass";
    if (criticalCount > 0) severity = "critical";
    else if (highCount > 0) severity = "high";
    else if (mediumCount > 0) severity = "medium";
    else if (lowCount > 0) severity = "low";

    scores.push({
      category: key as CategoryScore["category"],
      label: val.label,
      score,
      severity,
      trend: "stable",
      findingCount: total,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    });
  }

  return scores;
}

export function calculateOverall(categories: CategoryScore[]): number {
  if (categories.length === 0) return 100;
  const weights: Record<string, number> = {
    security: 0.25,
    "ai-safety": 0.2,
    "code-quality": 0.15,
    performance: 0.15,
    deployment: 0.15,
    dependencies: 0.05,
    testing: 0.025,
    documentation: 0.025,
  };

  let totalScore = 0;
  let totalWeight = 0;
  for (const cat of categories) {
    const weight = weights[cat.category] || 0.1;
    totalScore += cat.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}

export function generateSummary(categories: CategoryScore[], findings: Finding[]): string {
  const critical = findings.filter((f) => f.severity === "critical");
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const total = findings.length;

  if (total === 0) return "No issues detected. This project appears production ready.";

  const parts: string[] = [];
  if (critical.length > 0) {
    parts.push(`${critical.length} critical issue${critical.length > 1 ? "s" : ""} require immediate attention.`);
  }
  if (high.length > 0) {
    parts.push(`${high.length} high severity issue${high.length > 1 ? "s" : ""} should be addressed.`);
  }
  if (medium.length > 0) {
    parts.push(`${medium.length} medium severity issue${medium.length > 1 ? "s" : ""} found.`);
  }

  const worstCat = categories.filter((c) => c.severity !== "pass").sort((a, b) => a.score - b.score)[0];
  if (worstCat) {
    parts.push(`The weakest area is ${worstCat.label} with a score of ${worstCat.score}/100.`);
  }

  return parts.join(" ");
}