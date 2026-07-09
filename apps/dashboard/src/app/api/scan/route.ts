import { NextResponse } from "next/server";
import { scanProject } from "@agent-preflight/scanner";

export async function POST() {
  try {
    const report = await scanProject(process.cwd());
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: "Scan failed", details: String(err) },
      { status: 500 }
    );
  }
}