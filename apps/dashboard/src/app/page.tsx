"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function LandingPage() {
  useEffect(() => {
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

    const cards = document.querySelectorAll<HTMLElement>(".zoom-card");
    const zoomObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const inner = entry.target.querySelector<HTMLElement>(".zoom-card__inner");
          if (!inner) continue;
          const ratio = entry.intersectionRatio;
          if (ratio > 0) {
            const scale = 1 + 0.02 * (1 - ratio);
            inner.style.transform = `scale(${scale})`;
          }
        }
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20), rootMargin: "0px" },
    );

    cards.forEach((card) => zoomObserver.observe(card));

    return () => {
      fadeObserver.disconnect();
      zoomObserver.disconnect();
    };
  }, []);

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

  return (
    <div>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="bg-grid" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="relative z-10">
        <nav className="fixed top-0 left-0 right-0 z-50 glass-nav h-16 flex items-center">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 w-full flex items-center justify-between">
            <a href="#" className="text-sm font-bold tracking-[0.08em] uppercase text-white/90 hover:text-white transition-colors">
              preflight
            </a>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-[13px] text-[var(--color-muted)] hover:text-white transition-colors hidden sm:block">Features</a>
              <a href="#architecture" className="text-[13px] text-[var(--color-muted)] hover:text-white transition-colors hidden sm:block">Architecture</a>
              <Link
                href="/dashboard"
                className="text-[12px] font-medium px-5 py-2 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-white/30 transition-all"
              >
                Dashboard
              </Link>
              <a
                href="https://github.com/marsley01/agent-preflight"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium px-5 py-2 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-white/30 transition-all"
              >
                GitHub
              </a>
            </div>
          </div>
        </nav>

        <section id="hero" className="min-h-[100dvh] flex items-center pt-24 pb-16 md:pb-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 max-w-[1400px] mx-auto px-6 md:px-10 w-full">
            <div className="md:col-span-7 flex flex-col justify-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] border border-[var(--color-border)] rounded-full px-4 py-1.5 mb-8 w-fit">
                <span className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full" />
                Open source
              </span>
              <h1 className="text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[0.95] tracking-tighter text-white mb-6 whitespace-pre-line">
                Run any agent.{"\n"}Anywhere.
              </h1>
              <p className="text-base md:text-lg text-[var(--color-muted)] leading-relaxed max-w-[48ch] mb-10">
                One runtime. Any framework. Any model. Any cloud. Deploy agents like code.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-7 py-3 bg-[var(--color-accent)] text-white text-sm font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-all duration-300"
                >
                  Get Started
                </Link>
                <a
                  href="#architecture"
                  className="inline-flex items-center px-7 py-3 text-sm text-white/70 border border-[var(--color-border)] rounded-full hover:border-white/30 hover:text-white transition-all duration-300"
                >
                  Architecture
                </a>
              </div>
            </div>
            <div className="md:col-span-5 flex items-center justify-center mt-12 md:mt-0">
              <pre className="text-[9px] md:text-[10px] leading-[1.4] text-[var(--color-muted)] font-mono bg-[var(--color-surface)]/40 border border-[var(--color-border)] rounded-2xl p-5 md:p-6 w-full overflow-hidden select-none">
{`┌──────────────────────────────────────┐
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
└──────────────────────────────────────┘`}
              </pre>
            </div>
          </div>
        </section>

        <section id="trust" className="py-10 border-t border-[var(--color-border)]">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10">
            <div className="overflow-hidden">
              <div className="marquee-track flex gap-8 md:gap-16 whitespace-nowrap">
                {["CrewAI", "LangGraph", "AutoGen", "OpenAI SDK", "Mastra", "Any Framework"].map((f) => (
                  <span key={f} className="flex-shrink-0 text-sm font-medium text-[var(--color-muted)]/60 uppercase tracking-[0.05em]">{f}</span>
                ))}
                {["CrewAI", "LangGraph", "AutoGen", "OpenAI SDK", "Mastra", "Any Framework"].map((f) => (
                  <span key={`dup-${f}`} className="flex-shrink-0 text-sm font-medium text-[var(--color-muted)]/60 uppercase tracking-[0.05em]">{f}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 md:py-32">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10">
            <div className="mb-16">
              <h2 className="text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-white mb-4 whitespace-pre-line">
                Everything to run agents{"\n"}in production
              </h2>
              <p className="text-[var(--color-muted)] text-lg leading-relaxed max-w-[55ch]">
                Not another framework. An operating system that orchestrates agents across tools, models, and infrastructure.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <div key={f.title} className={`zoom-card fade-up ${i < 5 ? `fade-delay-${(i % 5) + 1}` : ""}`}>
                  <div className="zoom-card__inner">
                    <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-[var(--color-muted)] text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="architecture" className="py-24 md:py-32 bg-[var(--color-surface)]/30">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10">
            <div className="mb-16">
              <h2 className="text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-white mb-4">Architecture</h2>
              <p className="text-[var(--color-muted)] text-lg leading-relaxed max-w-[60ch]">Layered, replaceable components. Use what you need.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {layers.map((layer, i) => (
                <div key={layer.label} className={`zoom-card fade-up fade-delay-${(i % 5) + 1}`}>
                  <div className="zoom-card__inner">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)] mb-3">{layer.label}</div>
                    <div className="flex flex-wrap gap-2">
                      {layer.items.map((item) => (
                        <span key={item} className="layer-chip">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="get-started" className="py-24 md:py-32">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 text-center">
            <h2 className="text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-white mb-4">Start building.</h2>
            <p className="text-[var(--color-muted)] text-lg mb-10 max-w-[50ch] mx-auto leading-relaxed">
              Clone, install, run. Your first agent in minutes.
            </p>
            <div className="code-block mb-10 inline-block text-left">
              git clone https://github.com/marsley01/agent-preflight<br />
              <span className="highlight">cd agent-preflight</span><br />
              pnpm install<br />
              pnpm dev
            </div>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a
                href="https://github.com/marsley01/agent-preflight"
                target="_blank"
                rel="noopener noreferrer"
                className="px-7 py-3 bg-[var(--color-accent)] text-white text-sm font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-all duration-300"
              >
                View on GitHub
              </a>
              <Link
                href="/dashboard"
                className="px-7 py-3 text-sm text-white/70 border border-[var(--color-border)] rounded-full hover:border-white/30 hover:text-white transition-all duration-300"
              >
                Explore Dashboard
              </Link>
            </div>
          </div>
        </section>

        <footer className="py-8 border-t border-[var(--color-border)]">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between text-sm text-[var(--color-muted)]">
            <span>Agent Preflight — open source</span>
            <a
              href="https://github.com/marsley01/agent-preflight"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
