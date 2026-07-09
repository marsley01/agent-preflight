import { NextRequest, NextResponse } from "next/server";
import { scanProject } from "@agent-preflight/scanner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectPath = body.projectPath || process.cwd();
    const report = await scanProject(projectPath);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: "Scan failed", details: String(err) },
      { status: 500 }
    );
  }
}
