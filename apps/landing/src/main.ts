import "./style.css";

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

function Navbar(): HTMLElement {
  const nav = el("nav", { class: "fixed top-0 left-0 right-0 z-50 glass-nav h-16 flex items-center" });
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10 w-full flex items-center justify-between",
  });

  const logo = el("a", { href: "#", class: "text-sm font-bold tracking-[0.08em] uppercase text-white/90 hover:text-cream transition-colors" }, ["preflight"]);

  const links = el("div", { class: "flex items-center gap-6" });
  const items = [
    { href: "#features", label: "Features" },
    { href: "#architecture", label: "Architecture" },
  ];
  for (const item of items) {
    const a = el("a", {
      href: item.href,
      class: "text-[13px] text-muted hover:text-white transition-colors hidden sm:block",
    }, [item.label]);
    links.appendChild(a);
  }

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

  const badge = el("span", {
    class: "inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted border border-rock-border rounded-full px-4 py-1.5 mb-8 w-fit",
  });
  const dot = el("span", { class: "w-1.5 h-1.5 bg-gold rounded-full" });
  badge.appendChild(dot);
  badge.appendChild(document.createTextNode("Open source"));

  const h1 = el("h1", {
    class: "text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[0.95] tracking-tighter text-cream mb-6",
  }, ["Run any agent.\nAnywhere."]);

  const p = el("p", {
    class: "text-base md:text-lg text-muted leading-relaxed max-w-[48ch] mb-10",
  }, ["One runtime. Any framework. Any model. Any cloud. Deploy agents like code."]);

  const ctaRow = el("div", { class: "flex items-center gap-4" });
  const primary = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "inline-flex items-center px-7 py-3 bg-gold text-rock text-sm font-semibold rounded-full hover:bg-gold/90 transition-all duration-300",
  }, ["Get Started"]);
  const secondary = el("a", {
    href: "#architecture",
    class: "inline-flex items-center px-7 py-3 text-sm text-white/70 border border-rock-border rounded-full hover:border-white/30 hover:text-white transition-all duration-300",
  }, ["Architecture"]);

  ctaRow.appendChild(primary);
  ctaRow.appendChild(secondary);
  left.appendChild(badge);
  left.appendChild(h1);
  left.appendChild(p);
  left.appendChild(ctaRow);

  const right = el("div", { class: "md:col-span-5 flex items-center justify-center mt-12 md:mt-0" });
  const diag = el("pre", {
    class: "text-[9px] md:text-[10px] leading-[1.4] text-muted font-mono bg-rock-light/40 border border-rock-border rounded-2xl p-5 md:p-6 w-full overflow-hidden select-none",
  }, [`┌──────────────────────────────────────┐
│         API / CLI LAYER               │
│  ┌──────────┐  ┌──────────┐          │
│  │  REST    │  │   CLI    │          │
│  └────┬─────┘  └────┬─────┘          │
├───────┼──────────────┼───────────────┤
│       │  ORCHESTRATION LAYER          │
│  ┌────┴──────────────┴───────────┐   │
│  │      Agent Runtime             │   │
│  │  Planner · Scheduler · Router │   │
│  │  Executor · Supervisor         │   │
│  └───────────────────────────────┘   │
├──────────────────────────────────────┤
│  FRAMEWORK INTEGRATIONS               │
│  CrewAI · LangGraph · AutoGen         │
├──────────────────────────────────────┤
│  MEMORY · SECURITY · OBSERVABILITY   │
└──────────────────────────────────────┘`]);

  right.appendChild(diag);
  grid.appendChild(left);
  grid.appendChild(right);
  sec.appendChild(grid);
  return sec;
}

function TrustBar(): HTMLElement {
  const sec = section("trust", "py-10 border-t border-rock-border");

  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10",
  });

  // Marquee-style scrolling frameworks
  const marquee = el("div", { class: "overflow-hidden" });
  const track = el("div", { class: "marquee-track flex gap-8 md:gap-16 whitespace-nowrap" });

  const frameworks = ["CrewAI", "LangGraph", "AutoGen", "OpenAI SDK", "Mastra", "Any Framework"];
  // Duplicate for seamless loop
  const allItems = [...frameworks, ...frameworks];

  for (const f of allItems) {
    const span = el("span", { class: "flex-shrink-0 text-sm font-medium text-muted/60 uppercase tracking-[0.05em]" }, [f]);
    track.appendChild(span);
  }

  marquee.appendChild(track);
  inner.appendChild(marquee);
  sec.appendChild(inner);
  return sec;
}

function createZoomCard(title: string, desc: string, delayClass = ""): HTMLElement {
  const card = el("div", { class: `zoom-card fade-up ${delayClass}` });
  const inner = el("div", { class: "zoom-card__inner" });

  const h3 = el("h3", { class: "text-lg font-semibold text-cream mb-2" }, [title]);
  const p = el("p", { class: "text-muted text-sm leading-relaxed" }, [desc]);

  inner.appendChild(h3);
  inner.appendChild(p);
  card.appendChild(inner);
  return card;
}

function Features(): HTMLElement {
  const sec = section("features", "py-24 md:py-32");
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10",
  });

  const header = el("div", { class: "mb-16" });
  const h2 = el("h2", {
    class: "text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-cream mb-4",
  }, ["Everything to run agents\nin production"]);
  const sub = el("p", {
    class: "text-muted text-lg leading-relaxed max-w-[55ch]",
  }, ["Not another framework. An operating system that orchestrates agents across tools, models, and infrastructure."]);

  header.appendChild(h2);
  header.appendChild(sub);
  inner.appendChild(header);

  const grid = el("div", {
    class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
  });

  const features = [
    { title: "Universal Runtime", desc: "Run any agent framework — CrewAI, LangGraph, AutoGen — through a single runtime with unified lifecycle management." },
    { title: "Multi-Provider AI", desc: "Plug in any model provider: OpenAI, Anthropic, Google, Meta, Mistral, Groq, local Ollama, and more." },
    { title: "Agent Communication Protocol", desc: "Agents discover, message, and sync state through ACP. Built for multi-agent systems from day one." },
    { title: "Memory & Knowledge", desc: "Working, episodic, and semantic memory with vector + graph knowledge stores. Your agents remember context." },
    { title: "Enterprise Security", desc: "RBAC, ABAC, policy engine, encryption layer, and audit trails. Built for compliance-conscious teams." },
    { title: "Observability Built In", desc: "Metrics, traces, logs, health checks, and alerts via OpenTelemetry. Know what your agents are doing." },
    { title: "CLI & API First", desc: "Control everything from the terminal or REST API. Dashboard included for visual management." },
    { title: "Scales Anywhere", desc: "Docker, Kubernetes, Terraform, Helm. Deploy on-prem, cloud, or hybrid. No vendor lock-in." },
    { title: "Pluggable Architecture", desc: "Extend with custom plugins, providers, memory backends, and security policies via a clean registry." },
  ];

  features.forEach((f, i) => {
    const delayClass = i < 5 ? `fade-delay-${(i % 5) + 1}` : "";
    grid.appendChild(createZoomCard(f.title, f.desc, delayClass));
  });

  inner.appendChild(grid);
  sec.appendChild(inner);
  return sec;
}

function Architecture(): HTMLElement {
  const sec = section("architecture", "py-24 md:py-32 bg-rock-light/30");
  const inner = el("div", {
    class: "max-w-[1400px] mx-auto px-6 md:px-10",
  });

  const header = el("div", { class: "mb-16" });
  const h2 = el("h2", {
    class: "text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-cream mb-4",
  }, ["Architecture"]);
  const sub = el("p", {
    class: "text-muted text-lg leading-relaxed max-w-[60ch]",
  }, ["Layered, replaceable components. Use what you need."]);

  header.appendChild(h2);
  header.appendChild(sub);
  inner.appendChild(header);

  const layers = [
    { label: "API / CLI Layer", items: ["REST Gateway", "GraphQL Gateway", "CLI", "Dashboard"] },
    { label: "Orchestration Layer", items: ["Planner", "Scheduler", "Coordinator", "Registry", "Router", "Executor", "Supervisor"] },
    { label: "Protocol (ACP)", items: ["Discovery", "Messaging", "Task Queue", "State Sync"] },
    { label: "Framework Integration", items: ["CrewAI", "LangGraph", "AutoGen", "OpenAI SDK", "Mastra"] },
    { label: "Memory & Knowledge", items: ["Working Memory", "Episodic", "Semantic", "Knowledge Graph"] },
    { label: "AI Providers", items: ["OpenAI", "Anthropic", "Google", "Meta", "Mistral", "Groq", "Ollama", "DeepSeek", "Cohere", "xAI"] },
    { label: "Security", items: ["RBAC", "ABAC", "Policy Engine", "Encryption", "Audit Trail"] },
    { label: "Infrastructure", items: ["Docker", "Kubernetes", "Terraform", "Pulumi", "Helm"] },
  ];

  const grid = el("div", { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" });
  layers.forEach((layer, i) => {
    const card = el("div", { class: `zoom-card fade-up fade-delay-${(i % 5) + 1}` });
    const cardInner = el("div", { class: "zoom-card__inner" });

    const label = el("div", {
      class: "text-[11px] uppercase tracking-[0.12em] text-muted mb-3",
    }, [layer.label]);

    const chips = el("div", { class: "flex flex-wrap gap-2" });
    for (const item of layer.items) {
      const chip = el("span", { class: "layer-chip" }, [item]);
      chips.appendChild(chip);
    }

    cardInner.appendChild(label);
    cardInner.appendChild(chips);
    card.appendChild(cardInner);
    grid.appendChild(card);
  });

  inner.appendChild(grid);
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
  }, ["Start building."]);
  const p = el("p", {
    class: "text-muted text-lg mb-10 max-w-[50ch] mx-auto leading-relaxed",
  }, ["Clone, install, run. Your first agent in minutes."]);

  const codeBlock = el("div", { class: "code-block mb-10 inline-block text-left" }, [
    "git clone https://github.com/marsley01/agent-preflight\n",
    el("span", { class: "highlight" }, ["cd agent-preflight"]),
    "\npnpm install\npnpm dev"
  ]);

  const linkRow = el("div", { class: "flex items-center justify-center gap-4 flex-wrap" });
  const repo = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "px-7 py-3 bg-gold text-rock text-sm font-semibold rounded-full hover:bg-gold/90 transition-all duration-300",
  }, ["View on GitHub"]);
  const explore = el("a", {
    href: "#features",
    class: "px-7 py-3 text-sm text-white/70 border border-rock-border rounded-full hover:border-white/30 hover:text-white transition-all duration-300",
  }, ["Explore Features"]);

  linkRow.appendChild(repo);
  linkRow.appendChild(explore);

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
    class: "max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between text-sm text-muted",
  });
  const left = el("span", {}, ["Agent Preflight — open source"]);
  const right = el("a", {
    href: "https://github.com/marsley01/agent-preflight",
    target: "_blank",
    class: "hover:text-white transition-colors",
  }, ["GitHub"]);

  inner.appendChild(left);
  inner.appendChild(right);
  foot.appendChild(inner);
  return foot;
}

// Background layers
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

// Scroll-based zoom effect for zoom-cards
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
        // Scale from 1.02 to 1 based on how much is visible
        // When just entering (ratio ~0), scale is 1.02
        // When fully visible (ratio ~1), scale is 1
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
  APP.appendChild(TrustBar());
  APP.appendChild(Features());
  APP.appendChild(Architecture());
  APP.appendChild(GetStarted());
  APP.appendChild(Footer());

  // Intersection observer for fade-up
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

  // Init zoom cards
  initZoomCards();
}

init();