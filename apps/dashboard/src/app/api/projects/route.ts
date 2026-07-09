import { NextResponse } from "next/server";
import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export async function GET() {
  try {
    const current = process.cwd();
    const parent = resolve(current, "..");
    const entries = readdirSync(parent, { withFileTypes: true });
    const projects = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => {
        const fullPath = resolve(parent, e.name);
        const hasPackageJson = readdirSync(fullPath).includes("package.json");
        return {
          name: e.name,
          path: fullPath,
          hasPackageJson,
        };
      })
      .filter((p) => p.hasPackageJson);

    return NextResponse.json({ projects, currentDir: current, parentDir: parent });
  } catch (err) {
    return NextResponse.json({ projects: [], currentDir: process.cwd(), error: String(err) });
  }
}
