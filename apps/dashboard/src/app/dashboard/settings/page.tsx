"use client";

import { useState, useEffect } from "react";

const PATH_KEY = "agent-preflight-project-path";

export default function SettingsPage() {
  const [projectPath, setProjectPath] = useState(".");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const savedPath = localStorage.getItem(PATH_KEY);
      if (savedPath) setProjectPath(savedPath);
    } catch {}
  }, []);

  const save = () => {
    try {
      localStorage.setItem(PATH_KEY, projectPath);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white mb-2">Settings</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">Configure scan preferences</p>

      <div className="card p-5 space-y-6">
        <div>
          <label className="text-sm font-medium text-white block mb-1">Default Project Path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={projectPath}
              onChange={(e) => { setProjectPath(e.target.value); setSaved(false); }}
              placeholder="e.g. /path/to/project or ."
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
            />
            <button
              onClick={save}
              className="btn-primary text-sm"
            >
              {saved ? "Saved!" : "Save"}
            </button>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Path to the project to scan. Use <code className="text-white/60">.</code> for current directory.
          </p>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-medium text-white mb-2">About Scans</h3>
          <ul className="text-xs text-[var(--color-muted)] space-y-1.5">
            <li><span className="text-white/60">Security</span> — Checks for secrets, SQL injection, XSS, CSP, and dependency risks</li>
            <li><span className="text-white/60">AI Safety</span> — Analyzes AI agent code for prompt injection, guardrails, and unsafe outputs</li>
            <li><span className="text-white/60">Code Quality</span> — Finds unused deps, large files, TODOs, console logs, and empty files</li>
            <li><span className="text-white/60">Performance</span> — Detects large deps, unoptimized images, missing code splitting, and large assets</li>
            <li><span className="text-white/60">Deployment</span> — Checks for build scripts, Docker, CI/CD config, and env files</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
