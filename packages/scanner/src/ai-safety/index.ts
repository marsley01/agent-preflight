import type { Finding, ScannerResult } from "../types";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

function walkFiles(dir: string, ext: string[] = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".json", ".yaml", ".yml"]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".next" && entry.name !== ".venv") {
        results.push(...walkFiles(full, ext));
      } else if (entry.isFile() && ext.some((e) => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

export function aiSafetyScanner(projectRoot: string): ScannerResult {
  const findings: Finding[] = [];
  const start = Date.now();

  const sourceFiles = walkFiles(projectRoot);
  const relevantFiles: string[] = [];

  for (const f of sourceFiles) {
    try {
      const c = readFileSync(f, "utf-8");
      if (/openai|anthropic|langchain|langgraph|crewai|ai\/react|@ai-sdk|mastra|llamaindex|prompt|completion|chat\.completions/i.test(c)) {
        relevantFiles.push(f);
      }
    } catch {}
  }

  if (relevantFiles.length === 0) {
    return { scanner: "AI Safety Scanner", category: "ai-safety", findings: [], durationMs: Date.now() - start };
  }

  const promptPatterns = [
    /system\s*:\s*["'`][^"'`]{0,200}ignore all previous/i,
    /system\s*:\s*["'`][^"'`]{0,200}you are now/i,
    /role\s*:\s*['"]system['"]/,
    /prompt.*injection/i,
  ];
  for (const f of relevantFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      const rel = relative(projectRoot, f);
      for (const pat of promptPatterns) {
        if (pat.test(content)) {
          findings.push({
            id: "AI-001",
            title: "Potential prompt injection risk",
            description: "File uses system prompts or role-based messaging without input sanitization.",
            severity: "high",
            category: "ai-safety",
            file: rel,
            impact: "Attackers can override your system prompt and manipulate agent behavior.",
            suggestion: "Sanitize user input before including it in prompts.",
            references: ["https://owasp.org/www-community/attacks/Prompt_Injection"],
            risk: "high",
            effort: "medium",
            confidence: 0.8,
          });
          break;
        }
      }
    } catch {}
  }

  for (const f of relevantFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      const rel = relative(projectRoot, f);
      if (/(?:innerHTML|dangerouslySetInnerHTML|eval)\s*=.*(?:completion|response|answer|message)/i.test(content) ||
          /\.content\s*.*(?:innerHTML|eval|Function\s*\()/i.test(content)) {
        findings.push({
          id: "AI-002",
          title: "LLM output unsafely handled",
          description: "LLM response is being injected into the DOM without sanitization.",
          severity: "critical",
          category: "ai-safety",
          file: rel,
          impact: "Attackers can inject malicious code through model output.",
          suggestion: "Sanitize all LLM output before rendering.",
          risk: "high",
          effort: "low",
          confidence: 0.7,
        });
        break;
      }
    } catch {}
  }

  let hasGuardrails = false;
  for (const f of relevantFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      if (/(?:guardrail|moderation|contentFilter|content_filter|safety_settings|safe_prompt)/i.test(content)) {
        hasGuardrails = true;
        break;
      }
    } catch {}
  }
  if (!hasGuardrails) {
    findings.push({
      id: "AI-003",
      title: "No AI guardrails detected",
      description: "No content moderation, safety filters, or guardrail mechanisms were found.",
      severity: "high",
      category: "ai-safety",
      impact: "Without guardrails, LLM outputs may contain harmful content.",
      suggestion: "Implement content moderation APIs or guardrail libraries.",
      references: ["https://platform.openai.com/docs/guides/moderation"],
      risk: "medium",
      effort: "medium",
      confidence: 0.8,
    });
  }

  for (const f of relevantFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      const toolCount = (content.match(/(?:tool|function)\s*:\s*\{/gi) || []).length;
      if (toolCount > 8) {
        findings.push({
          id: "AI-004",
          title: "Excessive tool/function count",
          description: `Found ${toolCount} tool definitions. High tool counts increase attack surface.`,
          severity: "medium",
          category: "ai-safety",
          file: relative(projectRoot, f),
          impact: "Each tool is a potential vector for misalignment or abuse.",
          suggestion: "Reduce tool count or audit each tool for permissions.",
          risk: "medium",
          effort: "high",
          confidence: 0.6,
        });
        break;
      }
    } catch {}
  }

  for (const f of relevantFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      const rel = relative(projectRoot, f);
      if (/(?:memory|context|session)\s*\.\s*(?:push|add|set|save)\s*\(/i.test(content) && !/(?:encrypt|sanitize)/i.test(content)) {
        findings.push({
          id: "AI-005",
          title: "Unsafe memory handling detected",
          description: "Memory operations found without encryption or sanitization.",
          severity: "medium",
          category: "ai-safety",
          file: rel,
          impact: "Sensitive data in agent memory may be exposed or leaked.",
          suggestion: "Encrypt agent memory data at rest.",
          risk: "medium",
          effort: "medium",
          confidence: 0.5,
        });
        break;
      }
    } catch {}
  }

  for (const f of relevantFiles) {
    try {
      const content = readFileSync(f, "utf-8");
      const rel = relative(projectRoot, f);
      if (/temperature\s*[:=]\s*0\b/i.test(content) && /max_tokens|maxTokens/.test(content)) {
        findings.push({
          id: "AI-006",
          title: "Model set to zero temperature",
          description: "Temperature of 0 is appropriate for deterministic tasks but reduces creativity.",
          severity: "info",
          category: "ai-safety",
          file: rel,
          impact: "Model may become overly repetitive or fail on creative tasks.",
          suggestion: "Consider temperature 0.1-0.3 for deterministic tasks, 0.7-0.9 for creative tasks.",
          risk: "low",
          effort: "low",
          confidence: 0.9,
        });
        break;
      }
    } catch {}
  }

  return { scanner: "AI Safety Scanner", category: "ai-safety", findings, durationMs: Date.now() - start };
}