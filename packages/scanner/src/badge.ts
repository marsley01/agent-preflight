import type { ScanReport } from "./types";

export interface BadgeOptions {
  style?: "default" | "flat" | "flat-square" | "plastic";
  label?: string;
  showLabel?: boolean;
  compact?: boolean;
  theme?: "dark" | "light";
}

function sanitize(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function scoreToColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#f59e0b";
  if (score >= 50) return "#ef4444";
  return "#dc2626";
}

function scoreToLabel(score: number): string {
  if (score >= 90) return "Passing";
  if (score >= 70) return "Needs Review";
  if (score >= 50) return "Warning";
  return "Failing";
}

export function generateOverallBadgeSVG(report: ScanReport, options: BadgeOptions = {}): string {
  const { compact = false } = options;
  const score = report.overallScore;
  const color = scoreToColor(score);
  const label = compact ? scoreToLabel(score) : `${score}/100`;

  const width = compact ? 180 : 220;
  const labelWidth = compact ? 90 : 110;
  const valueWidth = width - labelWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">Preflight</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${sanitize(label)}</text>
  </g>
</svg>`;
}

export function generateCategoryBadgeSVG(label: string, score: number): string {
  const color = scoreToColor(score);
  const valueWidth = 60;
  const labelWidth = label.length * 7 + 14;
  const width = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="100" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect x="0" y="0" width="${width}" height="20" rx="3" ry="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${sanitize(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${score}/100</text>
  </g>
</svg>`;
}

export function generateMultiBadgeSVG(report: ScanReport): string {
  const badges: string[] = [];

  badges.push(generateOverallBadgeSVG(report, { compact: true }));

  for (const cat of report.categories) {
    badges.push(generateCategoryBadgeSVG(cat.label, cat.score));
  }

  const totalHeight = badges.length * 24 + 4;
  const maxWidth = badges.reduce((max, b) => {
    const w = parseInt(b.match(/width="(\d+)"/)?.[1] || "200", 10);
    return Math.max(max, w);
  }, 0);

  const badgeElements = badges.map((svg, i) => {
    const y = i * 24 + 2;
    return svg.replace(/<svg[^>]*>/, `<svg width="${maxWidth}" height="20" x="0" y="${y}" viewBox="0 0 ${maxWidth} 20">`);
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxWidth}" height="${totalHeight}" viewBox="0 0 ${maxWidth} ${totalHeight}">
    <rect width="${maxWidth}" height="${totalHeight}" fill="#0d1117" rx="4" ry="4"/>
    ${badgeElements}
  </svg>`;
}