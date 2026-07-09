import { NextRequest, NextResponse } from "next/server";
import { scanProject, generateOverallBadgeSVG } from "@agent-preflight/scanner";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const projectPath = process.cwd();

  try {
    const report = await scanProject(projectPath);
    const svg = generateOverallBadgeSVG(report);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="20">
      <rect width="180" height="20" rx="3" fill="#555"/>
      <rect x="90" width="90" height="20" fill="#666"/>
      <text x="45" y="14" fill="#fff" text-anchor="middle" font-size="11" font-family="sans-serif">Preflight</text>
      <text x="135" y="14" fill="#fff" text-anchor="middle" font-size="11" font-family="sans-serif">Unknown</text>
    </svg>`;
    return new NextResponse(fallback, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
}