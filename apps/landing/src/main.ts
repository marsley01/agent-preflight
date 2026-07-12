import "./style.css";
import { scanGitHubRepo, SCAN_STAGES, ScanAbortedError, type ScanReport, type ScanCheck } from "./scanner";

const APP = document.getElementById("app")!;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (string | Node | null)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) {
    if (c === null) continue;
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function section(id: string, className = "", ...children: HTMLElement[]): HTMLElement {
  return el("section", { id, class: className }, children);
}

// --- Line icons (no emojis) ---
function icon(name: string): HTMLElement {
  const span = el("span", { class: "icon" });
  const paths: Record<string, string> = {
    key: '<path d="M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M12.4 7H19M16 10.5V13M18 10.5V16a1 1 0 0 1-1 1h-1.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 14.5h4"/>',
    shield: '<path d="M12 3l7 3v5c0 4.2-3 7.3-7 8-4-0.7-7-3.8-7-8V6z"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3 3 7 3s7-1.3 7-3v-6"/>',
    form: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    ban: '<circle cx="12" cy="12" r="8"/><path d="M6 6l12 12"/>',
    link: '<path d="M9 15l6-6M10.5 7l1-1a3.5 3.5 0 0 1 5 5l-1 1M13.5 17l-1 1a3.5 3.5 0 0 1-5-5l1-1"/>',
    bolt: '<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2.5"/><path d="M9 4V3h6v1M9 9h6M9 13h6M9 17h4"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    check: '<path d="M5 12.5l4 4 10-10"/>',
    copy: '<rect x="9" y="5" width="10" height="13" rx="1.5"/><path d="M6 9H7a1 1 0 011 1v1"/><path d="M5 10a2 2 0 012-2h5a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6z"/>',
    wand: '<path d="M16.5 3.5l1.5 1.5-11 11L5.5 14.5 16.5 3.5z"/><path d="M15.5 4.5l2 2"/><path d="M3.5 18.5l1.5-1.5"/><path d="M13 2l.5 2M19 8l2 .5M12 22l1-3M20 16l3 1"/>',
  };
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ""}</svg>`;
  return span;
}

function statusIcon(status: ScanCheck["status"]): HTMLElement {
  const span = el("span", { class: "status-icon" });
  const fills: Record<ScanCheck["status"], string> = {
    pass: "#34c759",
    fail: "#ff3b30",
    warn: "#ff9500",
  };
  const inner: Record<ScanCheck["status"], string> = {
    pass: '<path d="M4.5 8.2l2.2 2.2 4.8-4.8" />',
    fail: '<path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />',
    warn: '<path d="M8 4.2v5" /><circle cx="8" cy="11.4" r="0.95" fill="#fff" stroke="none" />',
  };
  span.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="${fills[status]}"/><g stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none">${inner[status]}</g></svg>`;
  return span;
}

// --- State ---
let scanReport: ScanReport | null = null;
let scanning = false;
let scanError: string | null = null;
let scanProgress: { stage: string; completed: number; total: number } | null = null;
let abortController: AbortController | null = null;
let githubToken: string = sessionStorage.getItem('gh_token') || '';
function fixSuggestion(check: { status: string; message: string; file?: string; line?: number }): string {
  const msg = check.message.toLowerCase();
  if (msg.includes('service_role') || msg.includes('service role')) return 'Move to a server-only environment variable and create an API route that proxies requests server-side.';
  if (msg.includes('secret') || msg.includes('api key')) return 'Replace with server-side environment variables and use a backend endpoint to proxy authenticated calls.';
  if (msg.includes('.env is not gitignored')) return 'Add .env to your .gitignore file so secrets are never committed to the repository.';
  if (msg.includes('no .env.example')) return 'Create a .env.example file listing all required environment variables with placeholder values.';
  if (msg.includes('middleware')) return 'Add an authentication middleware file that checks session or token validity before allowing access to protected routes.';
  if (msg.includes('constructevent') || msg.includes('signature')) return 'Implement webhook signature verification using the SDK method to confirm events came from the provider.';
  if (msg.includes('rls') || msg.includes('row level')) return 'Enable Row Level Security on all database tables and define access policies for each role.';
  if (msg.includes('validation') || msg.includes('zod') || msg.includes('yup')) return 'Add Zod or Yup input validation schemas to all POST, PUT, and PATCH route handlers.';
  if (msg.includes('csp') || msg.includes('content-security')) return 'Add a Content-Security-Policy header that restricts which resources can be loaded by the browser.';
  if (msg.includes('hsts')) return 'Configure a Strict-Transport-Security header to enforce HTTPS connections for all visitors.';
  if (msg.includes('nosniff')) return 'Set the X-Content-Type-Options: nosniff response header to prevent browsers from MIME-sniffing responses.';
  if (msg.includes('xss') || msg.includes('dangerously') || msg.includes('innerhtml')) return 'Replace with safe React components, or sanitize the HTML string with a library like DOMPurify before rendering.';
  if (msg.includes('eval')) return 'Remove all eval() calls and use safer alternatives like JSON.parse or a proper expression parser.';
  if (msg.includes('csrf')) return 'Implement CSRF protection: add anti-forgery tokens to forms and set SameSite=Strict on session cookies.';
  if (msg.includes('debug')) return 'Set debug mode to false in production configuration and remove any debug-only endpoints from the build.';
  if (msg.includes('gitignore')) return 'Add common build output directories (.next, dist, build, .env.local) to .gitignore so they are not committed.';
  if (msg.includes('rate limit')) return 'Add rate limiting middleware to your API routes to prevent abuse (e.g. upstash-rate-limit, express-rate-limit).';
  if (msg.includes('cors')) return 'Configure CORS with an explicit list of allowed origins and restrict methods to only those needed in production.';
  if (msg.includes('clickjack')) return 'Add the X-Frame-Options: DENY header or the frame-ancestors CSP directive to prevent clickjacking.';
  if (msg.includes('cookie') && (msg.includes('secure') || msg.includes('http') || msg.includes('same'))) return 'Set httpOnly, secure, and SameSite=Strict flags on all cookies to prevent XSS and CSRF attacks.';
  if (msg.includes('mixed content')) return 'Replace all http:// external URLs with https:// equivalents to prevent mixed content warnings.';
  return 'Review this issue and apply the security best practice described in the check message.';
}

function generateFixPrompt(report: ScanReport): string {
  const issues: { status: string; message: string; file?: string; line?: number; category: string }[] = [];
  for (const cat of report.categories) {
    for (const check of cat.checks) {
      issues.push({ ...check, category: cat.name });
    }
  }

  const critical = issues.filter(i => i.status === 'fail');
  const warnings = issues.filter(i => i.status === 'warn');

  let prompt = 'You are a senior security engineer. Fix all vulnerabilities in the codebase attached to this conversation.\n\n';
  prompt += '# Scan Results — Fix Prompt\n\n';

  if (critical.length > 0) {
    prompt += `## Critical Issues (${critical.length} must fix)\n\n`;
    for (const issue of critical) {
      prompt += `### ${issue.category}: ${issue.message}\n`;
      if (issue.file) {
        prompt += `**File:** \`${issue.file}${issue.line ? `:${issue.line}` : ''}\`\n`;
      }
      prompt += `**Fix:** ${fixSuggestion(issue)}\n\n`;
    }
  }

  if (warnings.length > 0) {
    prompt += `## Warnings (${warnings.length} should fix)\n\n`;
    for (const issue of warnings) {
      prompt += `- ${issue.category}: ${issue.message}`;
      if (issue.file) prompt += ` (\`${issue.file}${issue.line ? `:${issue.line}` : ''}\`)`;
      prompt += `\n  Fix: ${fixSuggestion(issue)}\n\n`;
    }
  }

  const passed = issues.filter(i => i.status === 'pass');
  prompt += '## Already Passing\n';
  prompt += `These ${passed.length} checks passed — no action needed.\n`;
  prompt += '\n---\n';
  prompt += 'For each issue, provide the exact code changes needed. Use the file paths and line numbers above to locate and fix each vulnerability.';
  prompt += ' Apply fixes one at a time and ensure you do not introduce regressions.';

  return prompt;
}

function Navbar(): HTMLElement {
  const nav = el("nav", { class: "fixed top-0 left-0 right-0 z-50 glass-nav h-16 flex items-center" });
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10 w-full flex items-center justify-between",
  });

  const logo = el("a", { href: "#", class: "text-[15px] font-semibold tracking-tight text-[var(--color-text)] hover:opacity-70 transition-opacity" }, ["preflight"]);

  const links = el("div", { class: "flex items-center gap-6" });
  const btn = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "btn-secondary text-[13px] font-medium px-5 py-2 rounded-full",
  }, ["GitHub"]);

  links.appendChild(btn);
  inner.appendChild(logo);
  inner.appendChild(links);
  nav.appendChild(inner);
  return nav;
}

function Hero(): HTMLElement {
  const sec = section("hero", "min-h-[100dvh] flex items-center pt-24 pb-16 md:pb-24");

  const grid = el("div", {
    class: "grid grid-cols-1 md:grid-cols-12 gap-8 max-w-[1400px] mx-auto px-6 md:px-10 w-full",
  });

  const left = el("div", { class: "md:col-span-7 flex flex-col justify-center" });

  const h1 = el("h1", {
    class: "text-[clamp(2.1rem,5vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.03em] text-[var(--color-text)] mb-5",
  }, ["Paste your GitHub repo.\nSee what’s broken."]);

  const p = el("p", {
    class: "text-[17px] text-[var(--color-text-2)] leading-relaxed max-w-[52ch] mb-9",
  }, ["AI coding tools are incredible — but they repeat the same mistakes. Exposed keys, broken payments, missing security. Paste any public repo URL and we’ll check it for you."]);

  left.appendChild(h1);
  left.appendChild(p);
  left.appendChild(ScanBox());

  const right = el("div", { class: "md:col-span-5 flex items-center justify-center mt-12 md:mt-0" });
  const panel = el("div", {
    class: "w-full rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-6 md:p-7",
  });
  const panelTitle = el("div", { class: "text-[13px] font-semibold text-[var(--color-text)] mb-4 tracking-tight" }, ["What we look for"]);
  const list = el("ul", { class: "hero-list" });
  const checks = [
    "Exposed API keys",
    "Broken authentication",
    "Payment webhooks",
    "Row-level security",
    "Input validation",
  ];
  for (const c of checks) {
    const li = el("li", {}, [el("span", { class: "tick" }, [icon("check")]), document.createTextNode(c)]);
    list.appendChild(li);
  }
  panel.appendChild(panelTitle);
  panel.appendChild(list);
  right.appendChild(panel);

  grid.appendChild(left);
  grid.appendChild(right);
  sec.appendChild(grid);
  return sec;
}

function ScanBox(): HTMLElement {
  const container = el("div", { class: "w-full max-w-[560px]" });

  const inputRow = el("div", { class: "flex items-center gap-3" });

  const input = el("input", {
    id: "repo-input",
    type: "text",
    placeholder: "https://github.com/user/repo",
    class: "field flex-1 px-4 py-3.5 text-[15px]",
  }) as HTMLInputElement;

  const scanBtn = el("button", {
    id: "scan-btn",
    class: "btn-primary px-7 py-3.5 text-[15px] shrink-0",
  }, ["Scan"]) as HTMLButtonElement;

  input.addEventListener("keydown", (e) => { if (e.key === "Enter") scanBtn.click(); });
  scanBtn.addEventListener("click", async () => {
    const url = input.value.trim();
    if (!url) return;

    scanning = true;
    scanError = null;
    scanReport = null;
    abortController = new AbortController();
    scanProgress = { stage: "Starting\u2026", completed: 0, total: SCAN_STAGES.length };
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning";
    renderResults();

    try {
      scanReport = await scanGitHubRepo(url, abortController.signal, (stage, completed, total) => {
        scanProgress = { stage, completed, total };
        renderResults();
      }, githubToken || undefined);
    } catch (err) {
      if (err instanceof ScanAbortedError) {
        scanError = "Scan cancelled.";
      } else if ((err as any)?.status === 403 || (err as any)?.status === 429) {
        scanError = "GitHub API rate limit reached. Add a fine-grained personal access token below for 5,000 requests/hour, or use \u2018npx @preflight-agent/cli scan\u2019 locally.";
      } else {
        scanError = "Something went wrong. Check the URL and try again.";
      }
    } finally {
      scanning = false;
      scanProgress = null;
      abortController = null;
      scanBtn.disabled = false;
      scanBtn.textContent = "Scan";
      renderResults();
    }
  });

  inputRow.appendChild(input);
  inputRow.appendChild(scanBtn);
  container.appendChild(inputRow);

  const note = el("p", { class: "text-[12px] text-[var(--color-text-3)] mt-3" }, ["Public repos only. Everything runs in your browser — nothing is uploaded or stored."]);
  container.appendChild(note);

  // Token input
  const tokenRow = el("div", { class: "mt-4 flex items-center gap-3" });
  const tokenInput = el("input", {
    id: "token-input",
    type: "password",
    placeholder: "GitHub token (optional \u2014 5,000 req/hr)",
    class: "field flex-1 px-4 py-2.5 text-[13px]",
    value: githubToken,
  }) as HTMLInputElement;

  const showToggle = el("button", {
    class: "btn-secondary text-[12px] px-3 py-2 rounded-full shrink-0",
    type: "button",
  }, ["Show"]) as HTMLButtonElement;

  showToggle.addEventListener("click", () => {
    const isPassword = tokenInput.type === "password";
    tokenInput.type = isPassword ? "text" : "password";
    showToggle.textContent = isPassword ? "Hide" : "Show";
  });

  tokenInput.addEventListener("input", () => {
    githubToken = tokenInput.value.trim();
    sessionStorage.setItem('gh_token', githubToken);
  });

  tokenRow.appendChild(tokenInput);
  tokenRow.appendChild(showToggle);
  container.appendChild(tokenRow);

  // Quick Demo
  const demoRow = el("div", { class: "mt-6 pt-6 border-t border-[var(--color-border)] flex items-center justify-between" });
  const demoLabel = el("span", { class: "text-[12px] font-medium text-[var(--color-text-3)]" }, ["Or try a demo scan:"]);
  const demoBtn = el("button", {
    class: "text-[13px] font-medium text-[var(--color-accent)] hover:opacity-70 transition-opacity",
    type: "button",
  }, ["View live example"]);

  demoBtn.addEventListener("click", () => {
    input.value = "https://github.com/vitejs/vite";
    scanBtn.click();
  });

  demoRow.appendChild(demoLabel);
  demoRow.appendChild(demoBtn);
  container.appendChild(demoRow);

  return container;
}

function ScanProgressSection(): HTMLElement {
  const sec = section("results", "py-16 md:py-24");

  const stages = SCAN_STAGES;
  const completed = scanProgress?.completed ?? 0;
  const total = scanProgress?.total ?? stages.length;
  const pct = Math.round((completed / total) * 100);

  const card = el("div", { class: "scan-card" });

  const head = el("div", { class: "scan-head" });
  head.appendChild(el("div", { class: "spinner" }));
  const headText = el("div", {});
  headText.appendChild(el("div", { class: "scan-title" }, ["Scanning repository"]));
  headText.appendChild(el("div", { class: "scan-sub" }, [
    "Checking ",
    el("b", {}, [scanProgress?.stage ?? ""]),
    ` · step ${Math.min(completed + (completed < total ? 1 : 0), total)} of ${total}`,
  ]));
  head.appendChild(headText);
  card.appendChild(head);

  const bar = el("div", { class: "sp-bar" });
  const fill = el("div", { class: "sp-bar-fill" });
  fill.setAttribute("style", `width: ${pct}%`);
  bar.appendChild(fill);
  card.appendChild(bar);

  const ul = el("ul", { class: "sp-steps" });
  stages.forEach((stage, i) => {
    const state = i < completed ? "done" : i === completed ? "active" : "pending";
    const row = el("li", { class: `sp-step ${state}` });
    const dot = el("span", { class: "sp-dot" });
    if (state === "active") dot.appendChild(el("span", { class: "spinner-sm" }));
    row.appendChild(dot);
    row.appendChild(document.createTextNode(stage));
    ul.appendChild(row);
  });
  card.appendChild(ul);

  const cancelRow = el("div", { class: "text-center mt-5" });
  const cancelBtn = el("button", {
    class: "btn-secondary text-[13px] px-5 py-2 rounded-full",
  }, ["Cancel scan"]) as HTMLButtonElement;
  cancelBtn.addEventListener("click", () => {
    abortController?.abort();
  });
  cancelRow.appendChild(cancelBtn);
  card.appendChild(cancelRow);

  sec.appendChild(card);
  return sec;
}

function ResultsSection(): HTMLElement | null {
  if (!scanReport && !scanning && !scanError) return null;

  const sec = section("results", "py-16 md:py-24");

  // Error
  if (scanError && !scanning) {
    const card = el("div", { class: "error-card" });
    card.appendChild(el("div", { class: "error-title" }, ["Scan failed"]));
    card.appendChild(el("div", { class: "error-desc" }, [scanError]));
    sec.appendChild(card);
    return sec;
  }

  // Progress
  if (scanning) return ScanProgressSection();

  if (!scanReport) return null;

  const inner = el("div", { class: "max-w-[900px] mx-auto px-6 md:px-10" });

  const header = el("div", { class: "mb-10 text-center" });
  const h2 = el("h2", {
    class: "text-[clamp(1.3rem,2vw,1.8rem)] font-bold tracking-[-0.02em] text-[var(--color-text)] mb-4",
  }, [`Scan results: ${scanReport.repo}`]);

  let total = 0;
  let passed = 0;
  let failed = 0;
  for (const cat of scanReport.categories) {
    for (const check of cat.checks) {
      total++;
      if (check.status === "pass") passed++;
      if (check.status === "fail") failed++;
    }
  }

  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  const scoreColor = score >= 80 ? "var(--color-green)" : score >= 50 ? "var(--color-orange)" : "var(--color-red)";

  const pill = el("div", { class: "score-pill", style: `background: ${scoreColor}14; color: ${scoreColor}` });
  pill.appendChild(el("span", { class: "score-num" }, [`${score}%`]));
  pill.appendChild(el("span", { class: "score-den" }, [`${passed}/${total} passed`]));
  header.appendChild(h2);
  header.appendChild(pill);
  inner.appendChild(header);

  const container = el("div", { class: "space-y-4 max-w-[700px] mx-auto" });
  for (const cat of scanReport.categories) {
    if (cat.checks.length === 0) continue;

    const card = el("div", { class: "cat-card" });
    const cardInner = el("div", { class: "cat-card__inner" });

    const catHeader = el("div", { class: "cat-title" });
    catHeader.appendChild(document.createTextNode(cat.name));

    const catFails = cat.checks.filter(c => c.status === "fail").length;
    if (catFails > 0) {
      catHeader.appendChild(el("span", { class: "badge" }, [`${catFails} issue${catFails > 1 ? "s" : ""}`]));
    }
    cardInner.appendChild(catHeader);

    for (const check of cat.checks) {
      const row = el("div", { class: "result-row" });
      row.appendChild(statusIcon(check.status));
      const msg = el("span", { class: "result-msg" }, [check.message]);
      row.appendChild(msg);
      if (check.file) {
        row.appendChild(el("span", { class: "result-loc" }, [`(${check.file}${check.line ? ":" + check.line : ""})`]));
      }
      cardInner.appendChild(row);
    }

    card.appendChild(cardInner);
    container.appendChild(card);
  }

  inner.appendChild(container);

  // Fix with AI prompt
  const fixCard = el("div", { class: "cat-card mt-8", style: "max-width:700px;margin-left:auto;margin-right:auto" });
  const fixInner = el("div", { class: "cat-card__inner" });
  const fixTitle = el("div", { class: "cat-title" });
  fixTitle.appendChild(icon("wand"));
  fixTitle.appendChild(document.createTextNode("Fix with AI"));
  fixInner.appendChild(fixTitle);

  const fixDesc = el("p", { class: "text-[14px] text-[var(--color-text-2)] mb-4 leading-relaxed" }, [
    "Copy this prompt and paste it into Cursor, Claude, or Copilot to fix all issues found in this scan.",
  ]);
  fixInner.appendChild(fixDesc);

  const prompt = generateFixPrompt(scanReport);
  const textarea = el("textarea", {
    readonly: "",
    class: "field w-full p-4 text-[13px] font-mono leading-relaxed resize-none",
    style: "min-height:120px;color:var(--color-text-2)",
    rows: "6",
  }) as HTMLTextAreaElement;
  textarea.value = prompt;

  const copyRow = el("div", { class: "flex items-center gap-3 mt-3" });
  const copyBtn = el("button", {
    class: "btn-primary px-5 py-2 text-[13px] flex items-center gap-2",
  }, [icon("copy"), document.createTextNode("Copy prompt")]) as HTMLButtonElement;
  let copyLabel: HTMLElement | null = null;

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      if (copyLabel) copyLabel.remove();
      copyLabel = el("span", { class: "text-[13px] text-[var(--color-green)] font-medium" }, ["Copied"]);
      copyRow.appendChild(copyLabel);
      setTimeout(() => copyLabel?.remove(), 2000);
    } catch {
      textarea.select();
      document.execCommand("copy");
      if (copyLabel) copyLabel.remove();
      copyLabel = el("span", { class: "text-[13px] text-[var(--color-green)] font-medium" }, ["Copied"]);
      copyRow.appendChild(copyLabel);
      setTimeout(() => copyLabel?.remove(), 2000);
    }
  });

  copyRow.appendChild(copyBtn);
  fixInner.appendChild(textarea);
  fixInner.appendChild(copyRow);
  fixCard.appendChild(fixInner);
  inner.appendChild(fixCard);

  sec.appendChild(inner);
  return sec;
}

function renderResults() {
  const existing = document.getElementById("results");
  if (existing) existing.remove();

  const elSec = ResultsSection();
  if (elSec) {
    elSec.id = "results";
    const getStarted = document.getElementById("get-started");
    if (getStarted) {
      getStarted.parentNode!.insertBefore(elSec, getStarted);
    } else {
      APP.appendChild(elSec);
    }
    if (scanning) elSec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function Problem(): HTMLElement {
  const sec = section("problem", "py-24 md:py-32 border-t border-[var(--color-border)]");

  const inner = el("div", { class: "max-w-[1400px] mx-auto px-6 md:px-10" });

  const h2 = el("h2", {
    class: "text-[clamp(1.6rem,2.5vw,2.3rem)] font-bold tracking-[-0.02em] text-[var(--color-text)] mb-4 text-center",
  }, ["AI writes fast. But it forgets things."]);

  const sub = el("p", {
    class: "text-[var(--color-text-2)] text-[17px] text-center max-w-[60ch] mx-auto mb-16 leading-relaxed",
  }, ["You use Cursor, Claude, or Copilot to ship faster than ever. But AI agents consistently miss the same safety checks."]);

  const cards = el("div", { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1000px] mx-auto" });

  const items = [
    { icon: "key", title: "Exposed secrets", desc: "API keys and passwords left in code that anyone can steal." },
    { icon: "card", title: "Broken payments", desc: "Webhooks without signature checks — anyone can fake a payment." },
    { icon: "shield", title: "Missing auth", desc: "Pages and APIs that should be private but aren’t." },
    { icon: "database", title: "Open databases", desc: "Tables without row-level security — data fully exposed." },
    { icon: "form", title: "Unchecked inputs", desc: "User data that’s never validated — a recipe for crashes." },
    { icon: "ban", title: "No rate limits", desc: "APIs with no protection — one bad script can take you down." },
  ];

  for (const item of items) {
    const card = el("div", { class: "zoom-card fade-up text-center" });
    const innerCard = el("div", { class: "zoom-card__inner" });
    innerCard.appendChild(icon(item.icon));
    innerCard.appendChild(el("h3", { class: "text-[17px] font-semibold text-[var(--color-text)] mt-4 mb-2" }, [item.title]));
    innerCard.appendChild(el("p", { class: "text-[var(--color-text-2)] text-[14px] leading-relaxed" }, [item.desc]));
    card.appendChild(innerCard);
    cards.appendChild(card);
  }

  inner.appendChild(h2);
  inner.appendChild(sub);
  inner.appendChild(cards);
  sec.appendChild(inner);
  return sec;
}

function HowItWorks(): HTMLElement {
  const sec = section("how-it-works", "py-24 md:py-32 bg-[var(--color-surface-2)]");

  const inner = el("div", { class: "max-w-[1400px] mx-auto px-6 md:px-10" });

  const h2 = el("h2", {
    class: "text-[clamp(1.6rem,2.5vw,2.3rem)] font-bold tracking-[-0.02em] text-[var(--color-text)] mb-16 text-center",
  }, ["How it works"]);

  const steps = el("div", { class: "grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1000px] mx-auto" });

  const stepData = [
    { num: "01", icon: "link", title: "Paste a repo URL", desc: "Any public GitHub repo. Yours, your team’s, or an open-source project." },
    { num: "02", icon: "bolt", title: "We scan it instantly", desc: "All checks run in your browser. Nothing is uploaded or stored." },
    { num: "03", icon: "clipboard", title: "Get your report", desc: "Green checks mean you’re good. Red shows exactly what to fix, with file and line." },
  ];

  for (const step of stepData) {
    const card = el("div", { class: "zoom-card fade-up" });
    const innerCard = el("div", { class: "zoom-card__inner" });
    innerCard.appendChild(el("div", { class: "text-[11px] uppercase tracking-[0.14em] font-semibold text-[var(--color-accent)] mb-3" }, [step.num]));
    innerCard.appendChild(icon(step.icon));
    innerCard.appendChild(el("h3", { class: "text-[17px] font-semibold text-[var(--color-text)] mt-3 mb-2" }, [step.title]));
    innerCard.appendChild(el("p", { class: "text-[var(--color-text-2)] text-[14px] leading-relaxed" }, [step.desc]));
    card.appendChild(innerCard);
    steps.appendChild(card);
  }

  inner.appendChild(h2);
  inner.appendChild(steps);
  sec.appendChild(inner);
  return sec;
}

function WhatWeCheck(): HTMLElement {
  const sec = section("checks", "py-24 md:py-32");

  const inner = el("div", { class: "max-w-[1400px] mx-auto px-6 md:px-10" });

  const h2 = el("h2", {
    class: "text-[clamp(1.6rem,2.5vw,2.3rem)] font-bold tracking-[-0.02em] text-[var(--color-text)] mb-4 text-center",
  }, ["What we check"]);

  const categories = el("div", { class: "grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px] mx-auto" });

  const cats = [
    { icon: "shield", title: "Security", checks: ["API keys that should never be public", ".env files that aren’t protected", "Secrets in client-side code"] },
    { icon: "lock", title: "Auth", checks: ["Pages that should require login but don’t", "Missing auth middleware", "API routes accessible without permission"] },
    { icon: "card", title: "Payments", checks: ["Webhooks without signature verification", "No error handling on payment routes", "No idempotency keys"] },
    { icon: "database", title: "Database", checks: ["Tables without row-level security", "Database URLs not configured", "SQL migration safety"] },
    { icon: "form", title: "API", checks: ["User inputs accepted without validation", "Missing rate limiting", "No CORS or security headers"] },
    { icon: "globe", title: "Web", checks: ["Missing CSP headers", "No clickjacking protection", "Cookie security flags"] },
  ];

  for (const cat of cats) {
    const card = el("div", { class: "zoom-card fade-up" });
    const innerCard = el("div", { class: "zoom-card__inner" });
    const header = el("div", { class: "flex items-center gap-3 mb-4" });
    header.appendChild(icon(cat.icon));
    header.appendChild(el("h3", { class: "text-[17px] font-semibold text-[var(--color-text)]" }, [cat.title]));
    innerCard.appendChild(header);

    const list = el("ul", { class: "space-y-2.5" });
    for (const check of cat.checks) {
      const li = el("li", { class: "text-[var(--color-text-2)] text-[14px] flex items-start gap-2.5" });
      const bullet = el("span", { class: "text-[var(--color-accent)] mt-0.5 shrink-0 font-semibold" }, ["→"]);
      li.appendChild(bullet);
      li.appendChild(document.createTextNode(check));
      list.appendChild(li);
    }
    innerCard.appendChild(list);
    card.appendChild(innerCard);
    categories.appendChild(card);
  }

  inner.appendChild(h2);
  inner.appendChild(categories);
  sec.appendChild(inner);
  return sec;
}

function GetStarted(): HTMLElement {
  const sec = section("get-started", "py-24 md:py-32");
  const inner = el("div", { class: "max-w-[1400px] mx-auto px-6 md:px-10 text-center" });

  const h2 = el("h2", {
    class: "text-[clamp(1.8rem,3vw,2.8rem)] font-bold tracking-[-0.02em] text-[var(--color-text)] mb-4",
  }, ["Run it locally too"]);
  const p = el("p", {
    class: "text-[var(--color-text-2)] text-[17px] mb-10 max-w-[50ch] mx-auto leading-relaxed",
  }, ["For a full scan of your local project, run one command in your terminal."]);

  const codeBlock = el("div", { class: "code-block mb-10 inline-block text-left" }, [
    el("span", { class: "text-[var(--color-text-3)]" }, ["$ "]),
    el("span", { class: "highlight" }, ["npx @preflight-agent/cli scan"]),
  ]);

  const linkRow = el("div", { class: "flex items-center justify-center gap-4 flex-wrap" });
  const repo = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "btn-primary px-7 py-3 text-[15px] rounded-full",
  }, ["Star on GitHub"]);

  linkRow.appendChild(repo);

  inner.appendChild(h2);
  inner.appendChild(p);
  inner.appendChild(codeBlock);
  inner.appendChild(linkRow);
  sec.appendChild(inner);
  return sec;
}

function Footer(): HTMLElement {
  const foot = el("footer", { class: "py-8 border-t border-[var(--color-border)]" });
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between text-[14px] text-[var(--color-text-2)] flex-wrap gap-4",
  });
  const left = el("span", {}, ["Built for people who build fast."]);

  const right = el("div", { class: "flex items-center gap-5" });
  const gh = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "hover:text-[var(--color-text)] transition-colors",
  }, ["GitHub"]);
  const npmLink = el("a", {
    href: "https://npmjs.com/package/@preflight-agent/cli",
    target: "_blank",
    class: "hover:text-[var(--color-text)] transition-colors",
  }, ["npm"]);

  right.appendChild(gh);
  right.appendChild(npmLink);
  inner.appendChild(left);
  inner.appendChild(right);
  foot.appendChild(inner);
  return foot;
}

function Background(): HTMLElement {
  const bg = el("div", { class: "fixed inset-0 z-0 pointer-events-none" });
  bg.appendChild(el("div", { class: "bg-grid" }));
  bg.appendChild(el("div", { class: "orb orb-1" }));
  bg.appendChild(el("div", { class: "orb orb-2" }));
  return bg;
}

function initZoomCards(): void {
  const cards = document.querySelectorAll<HTMLElement>(".zoom-card");
  if (!cards.length) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const card = entry.target;
      const inner = card.querySelector<HTMLElement>(".zoom-card__inner");
      if (!inner) continue;
      const ratio = entry.intersectionRatio;
      if (ratio > 0) {
        const scale = 1 + 0.015 * (1 - ratio);
        inner.style.transform = `scale(${scale})`;
      }
    }
  }, {
    threshold: Array.from({ length: 21 }, (_, i) => i / 20),
    rootMargin: "0px",
  });

  cards.forEach((card) => observer.observe(card));
}

function init(): void {
  APP.appendChild(Background());
  APP.appendChild(Navbar());
  APP.appendChild(Hero());
  APP.appendChild(Problem());
  APP.appendChild(HowItWorks());
  APP.appendChild(WhatWeCheck());
  APP.appendChild(GetStarted());
  APP.appendChild(Footer());

  const fadeObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      }
    },
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
  );

  document.querySelectorAll(".fade-up").forEach((e) => fadeObserver.observe(e));
  initZoomCards();
}

init();
