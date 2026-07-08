# Example: Automated Code Review Pipeline

This example demonstrates an automated code review system that analyzes pull requests, checks for issues, and generates review reports.

---

## Overview

A multi-agent pipeline processes pull requests through four stages:

1. **Code Fetcher** — Retrieves PR diff and metadata
2. **Static Analyzer** — Checks for code quality issues and anti-patterns
3. **Security Reviewer** — Scans for vulnerabilities and secrets
4. **Report Generator** — Produces a structured code review report

```
GitHub PR Event
     │
     ▼
┌──────────────┐
│Code Fetcher  │ ──► Fetch diff + metadata
└──────┬───────┘
       │
       ├─────────────────────────┐
       ▼                         ▼
┌──────────────┐        ┌──────────────┐
│Static        │        │Security      │
│Analyzer      │        │Reviewer      │
└──────┬───────┘        └──────┬───────┘
       │                       │
       └──────────┬────────────┘
                  ▼
┌──────────────┐
│Report        │ ──► PR Comment
│Generator     │
└──────────────┘
```

---

## Agent Definitions

### Code Fetcher Agent

```typescript
// agents/code-fetcher.ts
import { Agent } from '@agent-preflight/core';

export const codeFetcher = new Agent({
  name: 'code-fetcher',
  description: 'Fetches pull request code and metadata',
});

codeFetcher.on('message', async (ctx) => {
  const { repo, prNumber } = ctx.payload;
  const token = process.env.GITHUB_TOKEN;

  const [prRes, filesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  const prData = await prRes.json();
  const files = await filesRes.json();

  await ctx.reply({
    repo,
    prNumber,
    title: prData.title,
    author: prData.user?.login,
    files: files.map((f: any) => ({
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      diff: f.patch ?? '',
    })),
    stats: {
      totalFiles: files.length,
      totalAdditions: files.reduce((s: number, f: any) => s + f.additions, 0),
      totalDeletions: files.reduce((s: number, f: any) => s + f.deletions, 0),
    },
  });
});
```

### Static Analyzer Agent

```typescript
// agents/static-analyzer.ts
import { Agent } from '@agent-preflight/core';

export const staticAnalyzer = new Agent({
  name: 'static-analyzer',
  description: 'Static code analysis for quality and patterns',
});

const ANTI_PATTERNS = [
  { pattern: /any/, type: 'TYPE_SAFETY', severity: 'warning', message: 'Use of `any` type' },
  { pattern: /console\.log/, type: 'DEBUG_CODE', severity: 'warning', message: 'Console.log in production code' },
  { pattern: /TODO/, type: 'INCOMPLETE', severity: 'info', message: 'Incomplete code' },
  { pattern: /eslint-disable/, type: 'LINT_SUPPRESSION', severity: 'warning', message: 'ESLint rule disabled' },
];

staticAnalyzer.on('message', async (ctx) => {
  const { files } = ctx.payload;
  const analysis = files.map((file: any) => {
    const issues = ANTI_PATTERNS
      .filter(({ pattern }) => pattern.test(file.diff))
      .map(({ type, severity, message }) => ({ type, severity, message }));

    return { file: file.path, issues, issueCount: issues.length };
  });

  const totalIssues = analysis.reduce((s: number, f: any) => s + f.issueCount, 0);
  const score = Math.max(0, 100 - totalIssues * 5);

  await ctx.reply({ analysis, overallScore: score, totalIssues });
});
```

### Security Reviewer Agent

```typescript
// agents/security-reviewer.ts
import { Agent } from '@agent-preflight/core';

export const securityReviewer = new Agent({
  name: 'security-reviewer',
  description: 'Security-focused code review',
});

const SECRET_PATTERNS = [
  { regex: /sk-[a-zA-Z0-9]{20,}/, type: 'OPENAI_API_KEY', severity: 'critical' },
  { regex: /ghp_[a-zA-Z0-9]{36,}/, type: 'GITHUB_TOKEN', severity: 'critical' },
  { regex: /AKIA[0-9A-Z]{16}/, type: 'AWS_ACCESS_KEY', severity: 'critical' },
  { regex: /password\s*[:=]\s*['"][^'"]+['"]/, type: 'HARDCODED_PASSWORD', severity: 'high' },
  { regex: /eval\(/, type: 'EVAL_USAGE', severity: 'critical' },
  { regex: /innerHTML\s*=/, type: 'XSS_VULNERABLE', severity: 'high' },
  { regex: /exec\(/, type: 'COMMAND_INJECTION', severity: 'critical' },
];

securityReviewer.on('message', async (ctx) => {
  const { files } = ctx.payload;
  const findings: any[] = [];

  for (const file of files) {
    for (const { regex, type, severity } of SECRET_PATTERNS) {
      if (regex.test(file.diff)) {
        findings.push({ file: file.path, type, severity });
      }
    }
  }

  const critical = findings.filter((f: any) => f.severity === 'critical');
  const passed = critical.length === 0;

  await ctx.reply({ passed, findings, summary: { critical: critical.length } });
});
```

### Report Generator Agent

```typescript
// agents/report-generator.ts
import { Agent } from '@agent-preflight/core';

export const reportGenerator = new Agent({
  name: 'report-generator',
  description: 'Generates formatted review reports',
});

reportGenerator.on('message', async (ctx) => {
  const { prData, staticAnalysis, securityReview } = ctx.payload;

  const verdict = staticAnalysis.overallScore >= 70 && securityReview.passed
    ? 'APPROVED'
    : 'CHANGES_REQUESTED';

  await ctx.reply({
    pr: { title: prData.title, stats: prData.stats },
    quality: { score: `${staticAnalysis.overallScore}/100`, issues: staticAnalysis.totalIssues },
    security: { verdict: securityReview.passed ? 'PASSED' : 'FAILED', findings: securityReview.findings },
    verdict,
    actionItems: [
      ...(staticAnalysis.totalIssues > 0 ? ['Address code quality issues'] : []),
      ...(!securityReview.passed ? ['Fix security vulnerabilities before merge'] : []),
    ],
  });
});
```

---

## Workflow Definition

```typescript
// workflows/code-review.workflow.ts
import { Workflow } from '@agent-preflight/core';

const reviewWorkflow = new Workflow({
  name: 'code-review-pipeline',
  description: 'Automated PR code review',
  timeout: 300_000,
  steps: [
    {
      id: 'fetch',
      agentId: 'code-fetcher',
      input: { repo: '{{input.repo}}', prNumber: '{{input.prNumber}}' },
      timeout: 30_000,
    },
    {
      id: 'static-analysis',
      agentId: 'static-analyzer',
      dependsOn: ['fetch'],
      input: { files: '{{steps.fetch.output.files}}' },
      timeout: 120_000,
    },
    {
      id: 'security-review',
      agentId: 'security-reviewer',
      dependsOn: ['fetch'],
      input: { files: '{{steps.fetch.output.files}}' },
      timeout: 120_000,
    },
    {
      id: 'report',
      agentId: 'report-generator',
      dependsOn: ['static-analysis', 'security-review'],
      input: {
        prData: '{{steps.fetch.output}}',
        staticAnalysis: '{{steps.static-analysis.output}}',
        securityReview: '{{steps.security-review.output}}',
      },
      timeout: 30_000,
    },
  ],
});

export default reviewWorkflow;
```

---

## Usage

```bash
# Run code review on a PR
preflight run workflow code-review-pipeline \
  --input '{"repo": "my-org/my-repo", "prNumber": 42}'

# Monitor
preflight trace workflow code-review-pipeline --follow

# Get report
preflight inspect workflow code-review-pipeline --last
```

### Integration with GitHub Actions

```yaml
# .github/workflows/code-review.yml
name: Agent Preflight Code Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx @agent-preflight/cli run workflow code-review-pipeline \
          --input '{"repo": "${{ github.repository }}", "prNumber": ${{ github.event.pull_request.number }}}' \
          --env GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
```
