import { securityScanner } from "./security/index";
import { aiSafetyScanner } from "./ai-safety/index";
import { codeQualityScanner } from "./code-quality/index";
import { performanceScanner } from "./performance/index";
import { deploymentScanner } from "./deployment/index";
import { detectProject } from "./detect/index";
import { calculateCategories, calculateOverall, generateSummary } from "./score";
import { generateMarkdownReport, generateSARIF, generateJSON } from "./report";
import type { ScanReport } from "./types";
import { randomUUID } from "node:crypto";

export type { Finding, ScanReport, ScannerResult, ProjectDetection, CategoryScore, Severity, ScannerCategory, FindingCategory } from "./types";

export async function scanProject(projectRoot: string): Promise<ScanReport> {
  const startTime = performance.now();

  const detection = detectProject(projectRoot);

  const [securityRes, aiSafetyRes, codeQualityRes, perfRes, deploymentRes] = await Promise.all([
    securityScanner(projectRoot),
    aiSafetyScanner(projectRoot),
    codeQualityScanner(projectRoot),
    performanceScanner(projectRoot),
    deploymentScanner(projectRoot),
  ]);

  const scannerResults = [securityRes, aiSafetyRes, codeQualityRes, perfRes, deploymentRes];

  const categories = calculateCategories(scannerResults);
  const allFindings = scannerResults.flatMap((r) => r.findings);
  const overallScore = calculateOverall(categories);
  const summary = generateSummary(categories, allFindings);

  const report: ScanReport = {
    id: randomUUID(),
    projectName: detection.name,
    projectPath: projectRoot,
    timestamp: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startTime),
    detection,
    scannerResults,
    categories,
    overallScore,
    summary,
    totalFindings: allFindings.length,
    criticalCount: allFindings.filter((f) => f.severity === "critical").length,
    highCount: allFindings.filter((f) => f.severity === "high").length,
    mediumCount: allFindings.filter((f) => f.severity === "medium").length,
    lowCount: allFindings.filter((f) => f.severity === "low").length,
    infoCount: allFindings.filter((f) => f.severity === "info").length,
  };

  return report;
}

export { generateMarkdownReport, generateSARIF, generateJSON } from "./report";
export { generateOverallBadgeSVG, generateCategoryBadgeSVG, generateMultiBadgeSVG } from "./badge";