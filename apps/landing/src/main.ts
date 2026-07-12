import "./style.css";
import { scanGitHubRepo, type ScanReport } from "./scanner";

const APP = document.getElementById("app")!;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (string | HTMLElement)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) {
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function section(id: string, className = "", ...children: HTMLElement[]): HTMLElement {
  return el("section", { id, class: className }, children);
}

// --- State ---
let scanReport: ScanReport | null = null;
let scanning = false;
let scanError: string | null = null;

function Navbar(): HTMLElement {
  const nav = el("nav", { class: "fixed top-0 left-0 right-0 z-50 glass-nav h-16 flex items-center" });
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10 w-full flex items-center justify-between",
  });

  const logo = el("a", { href: "#", class: "text-sm font-bold tracking-[0.08em] uppercase text-white/90 hover:text-gold transition-colors" }, ["preflight"]);

  const links = el("div", { class: "flex items-center gap-6" });
  const btn = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "text-[12px] font-medium px-5 py-2 rounded-full border border-rock-border text-muted hover:text-white hover:border-white/30 transition-all",
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
    class: "text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter text-cream mb-4",
  }, ["Paste your GitHub repo.\nSee what\u2019s broken."]);

  const p = el("p", {
    class: "text-base md:text-lg text-muted leading-relaxed max-w-[50ch] mb-8",
  }, ["AI coding tools are incredible. But they make the same mistakes every time \u2014 exposed keys, broken payments, missing security. Paste any public repo URL and we\u2019ll check it for you."]);

  left.appendChild(h1);
  left.appendChild(p);
  left.appendChild(ScanBox());

  const right = el("div", { class: "md:col-span-5 flex items-center justify-center mt-12 md:mt-0" });
  const outputBlock = el("pre", {
    class: "text-[11px] md:text-[12px] leading-[1.5] text-muted font-mono bg-rock-light/40 border border-rock-border rounded-2xl p-5 md:p-6 w-full overflow-hidden select-none",
  }, [`Scan runs in your browser.
Nothing is uploaded.

Checks for:
  \u2705 Exposed API keys
  \u2705 Broken auth
  \u2705 Payment webhooks
  \u2705 RLS policies
  \u2705 Input validation`]);

  right.appendChild(outputBlock);
  grid.appendChild(left);
  grid.appendChild(right);
  sec.appendChild(grid);
  return sec;
}

function ScanBox(): HTMLElement {
  const container = el("div", { class: "w-full max-w-[550px]" });

  const inputRow = el("div", { class: "flex items-center gap-3" });

  const input = el("input", {
    id: "repo-input",
    type: "text",
    placeholder: "https://github.com/user/repo",
    class: "flex-1 bg-black/50 border border-rock-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors",
  }) as HTMLInputElement;

  const scanBtn = el("button", {
    id: "scan-btn",
    class: "px-6 py-3 bg-gold text-rock text-sm font-semibold rounded-xl hover:bg-gold/90 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0",
  }, ["Scan"]) as HTMLButtonElement;

  input.addEventListener("keydown", (e) => { if (e.key === "Enter") scanBtn.click(); });
  scanBtn.addEventListener("click", async () => {
    const url = input.value.trim();
    if (!url) return;

    scanning = true;
    scanError = null;
    scanReport = null;
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning\u2026";
    renderResults();

    try {
      scanReport = await scanGitHubRepo(url);
    } catch (err) {
      scanError = "Something went wrong. Check the URL and try again.";
    } finally {
      scanning = false;
      scanBtn.disabled = false;
      scanBtn.textContent = "Scan";
      renderResults();
    }
  });

  inputRow.appendChild(input);
  inputRow.appendChild(scanBtn);
  container.appendChild(inputRow);

  const note = el("p", { class: "text-[11px] text-muted/50 mt-2" }, ["Public repos only. All scanning happens in your browser \u2014 nothing is stored."]);
  container.appendChild(note);

  return container;
}

function scanIcon(status: string) {
  if (status === "pass") return "\u2705";
  if (status === "fail") return "\u274C";
  return "\u26A0\uFE0F";
}

function ResultsSection(): HTMLElement | null {
  if (!scanReport && !scanning && !scanError) return null;

  const sec = section("results", "py-16 md:py-24 bg-rock-light/30");

  const inner = el("div", {
    class: "max-w-[900px] mx-auto px-6 md:px-10",
  });

  // Error state
  if (scanError) {
    const errorCard = el("div", { class: "zoom-card fade-up visible" });
    const errorInner = el("div", { class: "zoom-card__inner" });
    const icon = el("div", { class: "text-2xl mb-2" }, ["\u274C"]);
    const title = el("h3", { class: "text-lg font-semibold text-cream mb-2" }, ["Scan failed"]);
    const desc = el("p", { class: "text-muted text-sm" }, [scanError]);
    errorInner.appendChild(icon);
    errorInner.appendChild(title);
    errorInner.appendChild(desc);
    errorCard.appendChild(errorInner);
    inner.appendChild(errorCard);
    sec.appendChild(inner);
    return sec;
  }

  // Loading state
  if (scanning) {
    const loadingCard = el("div", { class: "card p-8 text-center" });
    const spinner = el("div", { class: "inline-block w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-4" });
    const loadingText = el("p", { class: "text-muted text-sm" }, ["Scanning repository\u2026"]);
    loadingCard.appendChild(spinner);
    loadingCard.appendChild(loadingText);
    inner.appendChild(loadingCard);
    sec.appendChild(inner);
    return sec;
  }

  // Results
  if (!scanReport) return null;

  const header = el("div", { class: "mb-8 text-center" });
  const h2 = el("h2", {
    class: "text-[clamp(1.25rem,2vw,1.75rem)] font-bold tracking-tight text-cream mb-2",
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
  const scoreColor = score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";

  const scoreRow = el("div", { class: "flex items-center justify-center gap-4 mb-8" });
  const scoreEl = el("span", { class: `text-3xl font-bold ${scoreColor}` }, [`${score}%`]);
  const details = el("span", { class: "text-muted text-sm" }, [`${passed}/${total} passed`]);
  scoreRow.appendChild(scoreEl);
  scoreRow.appendChild(details);
  header.appendChild(h2);
  header.appendChild(scoreRow);
  inner.appendChild(header);

  const resultsContainer = el("div", { class: "space-y-4 max-w-[700px] mx-auto" });

  for (const cat of scanReport.categories) {
    if (cat.checks.length === 0) continue;

    const card = el("div", { class: "zoom-card fade-up visible" });
    const cardInner = el("div", { class: "zoom-card__inner" });

    const catHeader = el("div", { class: "flex items-center gap-2 mb-3" });
    const catTitle = el("h3", { class: "text-sm font-semibold text-cream" }, [cat.name]);
    catHeader.appendChild(catTitle);

    const catFails = cat.checks.filter(c => c.status === "fail").length;
    if (catFails > 0) {
      const badge = el("span", { class: "text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 ml-2" }, [`${catFails} issue${catFails > 1 ? "s" : ""}`]);
      catHeader.appendChild(badge);
    }

    cardInner.appendChild(catHeader);

    const list = el("div", { class: "space-y-1.5" });
    for (const check of cat.checks) {
      const row = el("div", { class: "flex items-start gap-2 text-sm" });
      const icon = el("span", { class: "shrink-0 mt-0.5 text-xs" }, [scanIcon(check.status)]);
      const msg = el("span", {
        class: check.status === "pass" ? "text-green-400/80" : check.status === "fail" ? "text-red-400/80" : "text-yellow-400/80",
      }, [check.message]);
      row.appendChild(icon);
      row.appendChild(msg);

      if (check.file) {
        const loc = el("span", { class: "text-muted/50 text-[10px] ml-1" }, [`(${check.file}${check.line ? ":" + check.line : ""})`]);
        row.appendChild(loc);
      }

      list.appendChild(row);
    }

    cardInner.appendChild(list);
    card.appendChild(cardInner);
    resultsContainer.appendChild(card);
  }

  inner.appendChild(resultsContainer);
  sec.appendChild(inner);
  return sec;
}

function renderResults() {
  const existing = document.getElementById("results");
  if (existing) existing.remove();

  const el = ResultsSection();
  if (el) {
    el.id = "results";
    const getStarted = document.getElementById("get-started");
    if (getStarted) {
      getStarted.parentNode!.insertBefore(el, getStarted);
    } else {
      APP.appendChild(el);
    }
    // Scroll to results
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function Problem(): HTMLElement {
  const sec = section("problem", "py-24 md:py-32 border-t border-rock-border");

  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10",
  });

  const h2 = el("h2", {
    class: "text-[clamp(1.5rem,2.5vw,2.25rem)] font-bold tracking-tight text-cream mb-4 text-center",
  }, ["AI writes fast. But it forgets things."]);

  const sub = el("p", {
    class: "text-muted text-lg text-center max-w-[60ch] mx-auto mb-16 leading-relaxed",
  }, ["You use Cursor, Claude, or Copilot to ship faster than ever. But AI agents consistently miss the same safety checks."]);

  const cards = el("div", { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1000px] mx-auto" });

  const items = [
    { icon: "\uD83D\uDD11", title: "Exposed secrets", desc: "API keys and passwords left in code that anyone can steal." },
    { icon: "\uD83D\uDCB3", title: "Broken payments", desc: "Webhooks without signature checks \u2014 anyone can fake a payment." },
    { icon: "\uD83D\uDD10", title: "Missing auth", desc: "Pages and APIs that should be private but aren\u2019t." },
    { icon: "\uD83D\uDEE1\uFE0F", title: "Open databases", desc: "Tables without row-level security \u2014 data fully exposed." },
    { icon: "\uD83D\uDCE6", title: "Unchecked inputs", desc: "User data that\u2019s never validated \u2014 a recipe for crashes." },
    { icon: "\uD83D\uDEAB", title: "No rate limits", desc: "APIs with no protection \u2014 one bad script can take you down." },
  ];

  for (const item of items) {
    const card = el("div", { class: "zoom-card fade-up text-center" });
    const innerCard = el("div", { class: "zoom-card__inner" });
    const iconEl = el("div", { class: "text-3xl mb-3" }, [item.icon]);
    const title = el("h3", { class: "text-lg font-semibold text-cream mb-2" }, [item.title]);
    const desc = el("p", { class: "text-muted text-sm leading-relaxed" }, [item.desc]);
    innerCard.appendChild(iconEl);
    innerCard.appendChild(title);
    innerCard.appendChild(desc);
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
  const sec = section("how-it-works", "py-24 md:py-32 bg-rock-light/30");

  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10",
  });

  const h2 = el("h2", {
    class: "text-[clamp(1.5rem,2.5vw,2.25rem)] font-bold tracking-tight text-cream mb-16 text-center",
  }, ["How it works"]);

  const steps = el("div", { class: "grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1000px] mx-auto" });

  const stepData = [
    { num: "01", icon: "\uD83D\uDCE6", title: "Paste a repo URL", desc: "Any public GitHub repo. Yours, your team\u2019s, or an open-source project you\u2019re contributing to." },
    { num: "02", icon: "\u26A1", title: "We scan it instantly", desc: "All checks run in your browser. Nothing is uploaded or stored \u2014 your code never leaves your computer." },
    { num: "03", icon: "\uD83D\uDCCB", title: "Get your report", desc: "Green checks mean you\u2019re good. Red crosses show exactly what to fix, with file names and line numbers." },
  ];

  for (const step of stepData) {
    const card = el("div", { class: "zoom-card fade-up" });
    const innerCard = el("div", { class: "zoom-card__inner" });
    const num = el("div", { class: "text-[11px] uppercase tracking-[0.12em] text-gold mb-2" }, [step.num]);
    const iconEl = el("div", { class: "text-3xl mb-3" }, [step.icon]);
    const title = el("h3", { class: "text-lg font-semibold text-cream mb-2" }, [step.title]);
    const desc = el("p", { class: "text-muted text-sm leading-relaxed" }, [step.desc]);
    innerCard.appendChild(num);
    innerCard.appendChild(iconEl);
    innerCard.appendChild(title);
    innerCard.appendChild(desc);
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

  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10",
  });

  const h2 = el("h2", {
    class: "text-[clamp(1.5rem,2.5vw,2.25rem)] font-bold tracking-tight text-cream mb-4 text-center",
  }, ["What we check"]);

  const categories = el("div", { class: "grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px] mx-auto" });

  const cats = [
    { icon: "\uD83D\uDEE1\uFE0F", title: "Security", checks: ["API keys that should never be public", ".env files that aren\u2019t protected", "Secrets in client-side code"] },
    { icon: "\uD83D\uDD10", title: "Auth", checks: ["Pages that should require login but don\u2019t", "Missing auth middleware", "API routes accessible without permission"] },
    { icon: "\uD83D\uDCB3", title: "Payments", checks: ["Webhooks without signature verification", "No error handling on payment routes", "No idempotency keys"] },
    { icon: "\uD83D\uDCCA", title: "Database", checks: ["Tables without row-level security", "Database URLs not configured", "SQL migration safety"] },
    { icon: "\uD83D\uDCE6", title: "API", checks: ["User inputs accepted without validation", "Missing rate limiting", "No CORS or security headers"] },
    { icon: "\uD83D\uDCF6", title: "Web", checks: ["Missing CSP headers", "No clickjacking protection", "Cookie security flags"] },
  ];

  for (const cat of cats) {
    const card = el("div", { class: "zoom-card fade-up" });
    const innerCard = el("div", { class: "zoom-card__inner" });
    const header = el("div", { class: "flex items-center gap-3 mb-4" });
    const iconEl = el("span", { class: "text-2xl" }, [cat.icon]);
    const title = el("h3", { class: "text-lg font-semibold text-cream" }, [cat.title]);
    header.appendChild(iconEl);
    header.appendChild(title);
    innerCard.appendChild(header);

    const list = el("ul", { class: "space-y-2" });
    for (const check of cat.checks) {
      const li = el("li", { class: "text-muted text-sm flex items-start gap-2" });
      const bullet = el("span", { class: "text-gold mt-0.5 shrink-0" }, ["\u2192"]);
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
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10 text-center",
  });

  const h2 = el("h2", {
    class: "text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-cream mb-4",
  }, ["Run it locally too"]);
  const p = el("p", {
    class: "text-muted text-lg mb-10 max-w-[50ch] mx-auto leading-relaxed",
  }, ["For a full scan of your local project, run one command in your terminal."]);

  const codeBlock = el("div", { class: "code-block mb-10 inline-block text-left" }, [
    el("span", { class: "text-white/40" }, ["$ "]),
    el("span", { class: "highlight" }, ["npx @agent-preflight/cli scan"]),
  ]);

  const linkRow = el("div", { class: "flex items-center justify-center gap-4 flex-wrap" });
  const repo = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "px-7 py-3 bg-gold text-rock text-sm font-semibold rounded-full hover:bg-gold/90 transition-all duration-300",
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
  const foot = el("footer", {
    class: "py-8 border-t border-rock-border",
  });
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between text-sm text-muted flex-wrap gap-4",
  });
  const left = el("span", {}, ["Built for people who build fast."]);

  const right = el("div", { class: "flex items-center gap-4" });
  const gh = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "hover:text-white transition-colors",
  }, ["GitHub"]);
  const npmLink = el("a", {
    href: "https://npmjs.com/package/@agent-preflight/cli",
    target: "_blank",
    class: "hover:text-white transition-colors",
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
  const grid = el("div", { class: "bg-grid" });
  const orb1 = el("div", { class: "orb orb-1" });
  const orb2 = el("div", { class: "orb orb-2" });
  bg.appendChild(grid);
  bg.appendChild(orb1);
  bg.appendChild(orb2);
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
        const scale = 1 + 0.02 * (1 - ratio);
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

  document.querySelectorAll(".fade-up").forEach((el) => fadeObserver.observe(el));
  initZoomCards();
}

init();
