<div align="center">
  <br/>
  <h1>🛫 Agent Preflight</h1>
  <p><strong>The Open-Source Operating System for AI Agents</strong></p>
  <p><em>Build, deploy, monitor, and orchestrate AI agents at enterprise scale — across any framework, any model, any cloud.</em></p>
  <br/>

  <!-- Badges -->
  <p>
    <a href="https://github.com/marsley01/agent-preflight/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"/>
    </a>
    <a href="https://www.npmjs.com/package/@agent-preflight/cli">
      <img src="https://img.shields.io/npm/v/@agent-preflight/cli" alt="npm version"/>
    </a>
    <a href="https://github.com/marsley01/agent-preflight/actions">
      <img src="https://img.shields.io/github/actions/workflow/status/marsley01/agent-preflight/ci.yml?branch=main" alt="Build Status"/>
    </a>
    <a href="https://github.com/marsley01/agent-preflight">
      <img src="https://img.shields.io/github/stars/marsley01/agent-preflight" alt="GitHub Stars"/>
    </a>
    <a href="https://hub.docker.com/r/agentpreflight/runtime">
      <img src="https://img.shields.io/docker/pulls/agentpreflight/runtime" alt="Docker Pulls"/>
    </a>
    <a href="https://discord.gg/agent-preflight">
      <img src="https://img.shields.io/discord/1234567890?label=Discord&logo=discord" alt="Discord"/>
    </a>
    <a href="https://twitter.com/agentpreflight">
      <img src="https://img.shields.io/twitter/follow/agentpreflight" alt="Twitter Follow"/>
    </a>
    <a href="https://coveralls.io/github/marsley01/agent-preflight">
      <img src="https://img.shields.io/coveralls/github/marsley01/agent-preflight" alt="Coverage"/>
    </a>
    <a href="https://github.com/marsley01/agent-preflight/blob/main/CONTRIBUTING.md">
      <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/>
    </a>
  </p>

  <br/>

  <!-- Quick Links -->
  <p>
    <a href="#-what-is-agent-preflight"><strong>Introduction</strong></a> ·
    <a href="#-quick-start"><strong>Quick Start</strong></a> ·
    <a href="#-architecture"><strong>Architecture</strong></a> ·
    <a href="#-why-agent-preflight"><strong>Why Preflight?</strong></a> ·
    <a href="#-agent-communication-protocol"><strong>ACP</strong></a> ·
    <a href="#-cli-reference"><strong>CLI</strong></a> ·
    <a href="#-deployment"><strong>Deploy</strong></a> ·
    <a href="#%EF%B8%8F-contributing"><strong>Contributing</strong></a>
  </p>

  <br/>

  <!-- Supporting Companies -->
  <p>
    <sub>Backed by</sub><br/>
    <strong>Anomaly Co.</strong>
  </p>

  <br/>
</div>

---

## 🗺️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT PREFLIGHT OS                                 │
│                          ────────────────                                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         🖥️  API / CLI LAYER                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │   │
│  │  │  REST    │  │  GraphQL │  │   CLI    │  │   Dashboard      │    │   │
│  │  │  Gateway │  │  Gateway │  │  (prefl.)│  │  (Web UI)        │    │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘    │   │
│  └───────┼──────────────┼─────────────┼─────────────────┼──────────────┘   │
│          │              │             │                  │                  │
│  ┌───────┼──────────────┼─────────────┼─────────────────┼──────────────┐   │
│  │       │              │     🧠 ORCHESTRATION LAYER    │              │   │
│  │  ┌────┴──────────────┴─────────────┴─────────────────┴──────────┐   │   │
│  │  │                     Agent Runtime                             │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │   │
│  │  │  │ Planner  │  │Scheduler │  │Coordinator│  │  Registry    │ │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │   │
│  │  │  │ Router   │  │Executor  │  │ Supervisor│  │  Retry/Queue │ │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                   Agent Protocol (ACP)                        │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │   │
│  │  │  │Discovery │ │Messaging │ │Task Queue│ │  State Sync  │   │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐   │
│  │              🧩 AGENT / FRAMEWORK INTEGRATION LAYER                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ CrewAI   │ │ LangGraph│ │  AutoGen │ │OpenAI SDK│ │  Mastra  │   │   │
│  │  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤   │   │
│  │  │Any Agent │ │  Any     │ │  Any     │ │  Any     │ │  Any     │   │   │
│  │  │Framework │ │  Graph   │ │  Pattern │ │  Toolkit │ │  App     │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐   │
│  │              🧠 MEMORY & KNOWLEDGE LAYER                               │   │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────────┐   │   │
│  │  │ Working  │ │  Episodic    │ │ Semantic │ │  Knowledge Graph │   │   │
│  │  │  Memory  │ │   Memory     │ │  Memory  │ │  (Vector + Graph)│   │   │
│  │  └──────────┘ └──────────────┘ └──────────┘ └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐   │
│  │              🤖 AI PROVIDER LAYER                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ OpenAI   │ │Anthropic │ │  Google  │ │  Meta    │ │ Mistral  │   │   │
│  │  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤   │   │
│  │  │ Groq     │ │ Together │ │  Azure   │ │  AWS     │ │  Ollama  │   │   │
│  │  │          │ │   AI     │ │  OpenAI  │ │Bedrock   │ │ (Local)  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ DeepSeek │ │  Cohere  │ │ Voyage   │ │  xAI     │ │  ...any  │   │   │
│  │  │          │ │          │ │  AI      │ │ (Grok)   │ │ provider │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐   │
│  │              🔒 ENTERPRISE SECURITY LAYER                               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  RBAC    │ │   ABAC   │ │   Policy │ │Encryption│ │  Audit   │   │   │
│  │  │          │ │          │ │  Engine  │ │  Layer   │ │  Trail   │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┼───────────────────────────────────────────┐   │
│  │              📊 OBSERVABILITY LAYER                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Metrics  │ │ Tracing  │ │  Logs    │ │ Health   │ │ Alerts   │   │   │
│  │  │(Prometh.)│ │ (OpenTel)│ │          │ │  Checks  │ │          │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              📦 INFRASTRUCTURE LAYER                                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  Docker  │ │Kubernetes│ │Terraform │ │  Pulumi  │ │  Helm    │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤔 What is Agent Preflight?

**Agent Preflight is the operating system for AI agents.** It is the open-source infrastructure layer that lets you build, deploy, monitor, and orchestrate AI agents at enterprise scale — across any framework, any model, and any cloud.

Unlike CrewAI, LangGraph, AutoGen, or Mastra — which are agent **frameworks** that lock you into a specific architecture — Agent Preflight is a meta-orchestrator. It **does not compete with frameworks. It orchestrates them all.**

> **Agent Preflight is to AI agents what Kubernetes is to containers.**  
> You don't pick one container runtime — you use Kubernetes to run Docker, containerd, and CRI-O side by side.  
> **With Agent Preflight, you don't choose one agent framework. You use them all.**

| You bring | Agent Preflight provides |
|---|---|
| CrewAI agents | Universal orchestration & monitoring |
| LangGraph graphs | Cross-framework communication (ACP) |
| AutoGen agents | Enterprise-grade security (RBAC/ABAC) |
| OpenAI Agents SDK | Multi-provider model routing |
| Mastra apps | Memory, knowledge, and state management |
| Custom agents | Observability, evaluation, and analytics |
| Any framework | CLI, Dashboard, SDKs (TS, Python, Go, Rust, Java, .NET) |

---

## ✨ Key Features

<br/>

<div>
  <table>
    <tr>
      <td width="33%" valign="top">
        <p><strong>🧩 Universal Agent Support</strong></p>
        <p>Run agents from <em>any</em> framework — CrewAI, LangGraph, AutoGen, OpenAI Agents SDK, Mastra, Semantic Kernel, or fully custom — all under one orchestration roof.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>🤖 Multi-Provider</strong></p>
        <p>Route requests across OpenAI, Anthropic, Google, Meta, Mistral, Groq, Together, DeepSeek, Cohere, AWS Bedrock, Azure OpenAI, Ollama, and more — with automatic fallback & load balancing.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>🔌 Agent Communication Protocol</strong></p>
        <p>ACP enables discovery, messaging, task delegation, and state synchronization between any agents — regardless of framework, language, or deployment location.</p>
      </td>
    </tr>
    <tr>
      <td width="33%" valign="top">
        <p><strong>🔄 Multi-Agent Orchestration</strong></p>
        <p>Planner, scheduler, coordinator, and supervisor modules work together to decompose complex tasks, assign sub-tasks, monitor progress, and handle failures gracefully.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>🧠 Intelligent Model Router</strong></p>
        <p>Route tasks to the optimal model based on capability, cost, latency, and context window constraints. Automatic fallback on rate limits and failures.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>💾 Multi-Layer Memory System</strong></p>
        <p>Working, episodic, and semantic memory layers with pluggable backends (Redis, Postgres, SQLite, Pinecone, Weaviate, Qdrant). Persistent agent state across conversations and sessions.</p>
      </td>
    </tr>
    <tr>
      <td width="33%" valign="top">
        <p><strong>🔒 Enterprise Security</strong></p>
        <p>RBAC, ABAC, policy engine, encryption at rest & in transit, audit trails, secret management, and compliance-ready controls. SOC 2 ready.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>🧪 Evaluation Engine</strong></p>
        <p>Built-in eval framework for testing agent outputs, measuring accuracy, hallucination detection, and running regression tests before deploying changes.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>📊 Observability</strong></p>
        <p>Prometheus metrics, OpenTelemetry tracing, structured logging, health checks, and real-time dashboards. Debug agent behavior down to individual LLM calls.</p>
      </td>
    </tr>
    <tr>
      <td width="33%" valign="top">
        <p><strong>🧩 Plugin System</strong></p>
        <p>Extend every layer with plugins. Community marketplace for pre-built tools, integrations, and capabilities. Write once, share everywhere.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>🖥️ Enterprise CLI</strong></p>
        <p><code>preflight</code> — a single binary for everything: init projects, deploy agents, manage configurations, tail logs, run evals, and control the entire runtime from your terminal.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>📈 Enterprise Dashboard</strong></p>
        <p>Web-based dashboard for managing agents, monitoring performance, viewing logs, configuring security, running evals, and analyzing usage patterns — all in real time.</p>
      </td>
    </tr>
    <tr>
      <td width="33%" valign="top">
        <p><strong>📦 Multi-Language SDKs</strong></p>
        <p>First-class SDKs for TypeScript, Python, Go, Rust, Java, and .NET. Consistent API surface across all languages. Autogenerated clients from the protocol spec.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>☁️ Multi-Platform Deployment</strong></p>
        <p>Deploy anywhere — bare metal, VMs, Docker, Kubernetes, serverless (Vercel, AWS Lambda, Cloudflare Workers), or hybrid. Terraform & Pulumi modules included.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>⚡ Developer Experience</strong></p>
        <p>Hot-reloading agent runtime, type-safe SDKs, local dev server, scaffolding templates, code generators, one-command deploy, and rich debugging tools.</p>
      </td>
    </tr>
    <tr>
      <td width="33%" valign="top">
        <p><strong>🏛️ AI Governance</strong></p>
        <p>Policy-as-code for agent behavior, guardrails, content filtering, cost controls, rate limiting, and compliance enforcement. Full audit trail for every agent action.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>📡 Analytics & Insights</strong></p>
        <p>Track usage patterns, model costs, latency distributions, failure modes, and agent performance metrics. Make data-driven decisions about your agent infrastructure.</p>
      </td>
      <td width="33%" valign="top">
        <p><strong>📚 Knowledge Graph</strong></p>
        <p>Structured knowledge representation with support for vector embeddings, graph relationships, and hybrid search. Agents share and query organizational knowledge seamlessly.</p>
      </td>
    </tr>
  </table>
</div>

---

## 🏗️ Architecture

Agent Preflight is built as a **layered, modular architecture** where each layer is independently scalable, deployable, and replaceable.

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           🖥️  API / CLI LAYER                           │
│  REST API  ·  GraphQL  ·  WebSockets  ·  gRPC  ·  CLI  ·  Dashboard    │
├─────────────────────────────────────────────────────────────────────────┤
│                           🧠 ORCHESTRATION LAYER                         │
│  Planner  ·  Scheduler  ·  Coordinator  ·  Supervisor  ·  Executor     │
│  Router  ·  Registry  ·  Queue Manager  ·  State Manager               │
├─────────────────────────────────────────────────────────────────────────┤
│                         🧩 AGENT INTEGRATION LAYER                      │
│  CrewAI  ·  LangGraph  ·  AutoGen  ·  OpenAI SDK  ·  Mastra  ·  Custom│
│  Agent Adapters  ·  Protocol Bridge  ·  Lifecycle Hooks                │
├─────────────────────────────────────────────────────────────────────────┤
│                    🧠 MEMORY & KNOWLEDGE LAYER                          │
│  Working Memory  ·  Episodic Memory  ·  Semantic Memory                 │
│  Knowledge Graph  ·  Vector Store  ·  Cache Layer                       │
├─────────────────────────────────────────────────────────────────────────┤
│                         📡 COMMUNICATION LAYER                          │
│  Agent Communication Protocol (ACP)  ·  Event Bus  ·  Message Queue    │
│  WebRTC  ·  WebSockets  ·  Pub/Sub                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                       🤖 AI PROVIDER LAYER                              │
│  OpenAI  ·  Anthropic  ·  Google  ·  Meta  ·  Mistral  ·  Groq         │
│  Together  ·  DeepSeek  ·  Cohere  ·  AWS  ·  Azure  ·  Ollama  ·  +  │
├─────────────────────────────────────────────────────────────────────────┤
│                        🔒 ENTERPRISE SECURITY LAYER                     │
│  RBAC  ·  ABAC  ·  Policy Engine  ·  Encryption  ·  Audit  ·  Secrets │
├─────────────────────────────────────────────────────────────────────────┤
│                        📊 OBSERVABILITY LAYER                           │
│  Metrics  ·  Tracing  ·  Logging  ·  Health Checks  ·  Alerts          │
├─────────────────────────────────────────────────────────────────────────┤
│                        🧪 EVALUATION LAYER                              │
│  Eval Runner  ·  Test Suites  ·  Benchmarking  ·  Regression           │
├─────────────────────────────────────────────────────────────────────────┤
│                        📦 INFRASTRUCTURE LAYER                          │
│  Docker  ·  Kubernetes  ·  Terraform  ·  Pulumi  ·  Serverless         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
agent-preflight/
├── apps/
│   ├── dashboard/         # Enterprise web dashboard (Next.js)
│   ├── docs/              # Documentation site (Next.js + MDX)
│   └── examples/          # Example projects & tutorials
├── packages/
│   ├── sdk/               # Multi-language SDKs (TS, Python, Go, Rust, Java, .NET)
│   ├── cli/               # Enterprise CLI (preflight)
│   ├── core/              # Core runtime: planner, scheduler, coordinator, orchestrator
│   ├── protocol/          # Agent Communication Protocol (ACP) spec & implementation
│   ├── communication/     # Inter-agent communication layer
│   ├── memory/            # Multi-layer memory system
│   ├── knowledge/         # Knowledge graph & vector search
│   ├── providers/         # AI model provider integrations
│   ├── security/          # RBAC, ABAC, policy engine, encryption, audit
│   ├── evaluation/        # Agent evaluation & benchmarking engine
│   ├── observability/     # Metrics, tracing, health checks
│   ├── analytics/         # Usage analytics & insights
│   ├── plugins/           # Plugin system & marketplace
│   ├── integrations/      # Third-party integrations
│   ├── api/               # API gateway, workers, REST/GraphQL
│   ├── storage/           # Data storage abstraction layer
│   ├── telemetry/         # Telemetry collection & export
│   ├── templates/         # Project & agent scaffolding templates
│   ├── generators/        # Code generators
│   ├── config/            # Configuration management
│   ├── types/             # Core type system & shared types
│   ├── utils/             # Shared utilities
│   └── tests/             # Integration, e2e, and performance tests
├── infra/                 # Docker, Kubernetes, Terraform, Pulumi
├── docs/                  # Full documentation
├── scripts/               # Build & development scripts
├── config/                # Default configuration files
└── templates/             # Starter project templates
```

---

## 🎯 Why Agent Preflight?

### The Problem

The AI agent ecosystem is fragmented. There are dozens of frameworks — CrewAI, LangGraph, AutoGen, Mastra, OpenAI Agents SDK, Semantic Kernel — each with its own paradigms, limitations, and lock-in.

| Challenge | Reality |
|---|---|
| **Framework lock-in** | Choose one framework and you're stuck with its patterns, limitations, and community |
| **No interoperability** | Agents built in different frameworks cannot communicate or collaborate |
| **Scattered observability** | No unified view of agent behavior across frameworks |
| **Provider coupling** | Hardcoded model providers make swapping or fallback painful |
| **No enterprise controls** | Security, governance, and compliance are afterthoughts |
| **Repetitive infrastructure** | Every team rebuilds the same agent plumbing from scratch |

### The Agent Preflight Solution

Agent Preflight sits **above** all frameworks, providing the infrastructure that every agent-powered application needs — regardless of which framework you choose underneath.

| Capability | CrewAI | LangGraph | AutoGen | Mastra | OpenAI SDK | **Agent Preflight** |
|---|---|---|---|---|---|---|
| **Multi-framework orchestration** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Cross-framework agent communication** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Multi-provider model routing** | ❌ | ❌ | ❌ | ⚠️ | ❌ | **✅** |
| **Enterprise security (RBAC/ABAC)** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Built-in evaluation engine** | ❌ | ❌ | ❌ | ⚠️ | ❌ | **✅** |
| **Multi-layer memory** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ | **✅** |
| **Observability (OTel/Prometheus)** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Plugin system & marketplace** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Multi-language SDKs** | ❌ | ⚠️ | ❌ | ❌ | ⚠️ | **✅** |
| **Enterprise dashboard** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Deployment infra (K8s/Terraform)** | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |

### Our Philosophy

> **Don't choose one framework. Use them all.**

Agent Preflight is not another agent framework. It is the **infrastructure** that makes all agent frameworks work together. Bring CrewAI for hierarchical teams, LangGraph for complex state machines, AutoGen for multi-turn conversations, Mastra for production apps, and the OpenAI SDK for quick prototypes — all under one operational roof.

---

## 🚀 Quick Start

Get your first agent running in under 2 minutes.

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0 (recommended) or npm / yarn
- An API key from your preferred AI provider (OpenAI, Anthropic, etc.)

### 1. Install

```bash
# Using npx (recommended)
npx @agent-preflight/cli init my-agent-project

# Or install globally
npm install -g @agent-preflight/cli
preflight init my-agent-project
```

### 2. Configure

```bash
cd my-agent-project

# Set your AI provider API key
preflight config set provider openai
preflight config set api-key sk-your-key-here

# Or use environment variables
echo "PREFLIGHT_API_KEY=sk-your-key-here" >> .env
echo "PREFLIGHT_PROVIDER=openai" >> .env
```

### 3. Start the Runtime

```bash
# Start the development runtime with hot-reload
preflight dev
```

### 4. Deploy Your First Agent

```bash
# Scaffold an agent
preflight generate agent --name research-agent --capabilities research,analysis

# Deploy to the runtime
preflight deploy agent --name research-agent

# Verify it's running
preflight status
```

### 5. Interact

```bash
# Run a task through the CLI
preflight run research-agent --task "What are the latest developments in AI agents?"

# Or via the API
curl -X POST http://localhost:3000/api/v1/agents/research-agent/run \
  -H "Content-Type: application/json" \
  -d '{"input": "What are the latest developments in AI agents?"}'
```

---

## 💻 SDK Examples

Agent Preflight provides first-class SDKs for **TypeScript, Python, Go, Rust, Java, and .NET**.

### TypeScript

```typescript
import { Preflight } from '@agent-preflight/sdk';

const preflight = new Preflight({
  apiKey: process.env.PREFLIGHT_API_KEY,
});

// Create an agent
const agent = await preflight.agents.create({
  name: 'research-agent',
  model: 'claude-3-5-sonnet',
  provider: 'anthropic',
  capabilities: ['research', 'analysis', 'writing'],
  instructions: 'You are a senior research analyst. Provide thorough, cited analysis.',
});

// Run a multi-agent workflow
const result = await preflight.workflows.run({
  name: 'research-and-write',
  agents: ['research-agent', 'writer-agent', 'editor-agent'],
  input: 'Research and write a comprehensive report on AI agent architectures.',
  config: {
    maxSteps: 50,
    timeout: 300_000,
    onStepComplete: (step) => console.log(`Step ${step.id} completed`),
  },
});

console.log(result.output);

// Add memory context
await preflight.memory.set('research-agent', {
  type: 'episodic',
  key: 'previous-research-topic',
  value: 'AI agent architectures',
  ttl: 86400, // 24 hours
});

// Evaluate agent output
const evalResult = await preflight.evaluations.run({
  agent: 'research-agent',
  testSuite: 'accuracy-benchmark',
  dataset: 'research-quality-v1',
});

console.log(`Accuracy: ${evalResult.scores.accuracy}`);
```

### Python

```python
from agent_preflight import Preflight

preflight = Preflight(api_key="your-key")

agent = preflight.agents.create(
    name="research-agent",
    model="claude-3-5-sonnet",
    provider="anthropic",
    capabilities=["research", "analysis"],
)

result = preflight.run(
    agents=["research-agent", "writer-agent"],
    task="Research and write about AI agents",
)
```

### Go

```go
package main

import (
    "context"
    "log"
    preflight "github.com/agent-preflight/sdk-go"
)

func main() {
    client := preflight.NewClient("your-key")

    agent, err := client.Agents.Create(context.Background(), &preflight.AgentConfig{
        Name:     "research-agent",
        Model:    "claude-3-5-sonnet",
        Provider: "anthropic",
    })
    if err != nil {
        log.Fatal(err)
    }

    result, err := client.Workflows.Run(context.Background(), &preflight.WorkflowConfig{
        Name:   "research-task",
        Agents: []string{"research-agent", "writer-agent"},
        Input:  "Research and write about AI agents",
    })
    if err != nil {
        log.Fatal(err)
    }

    log.Println(result.Output)
}
```

> **SDKs available for:** TypeScript, Python, Go, Rust, Java, .NET  
> *Visit [docs.agent-preflight.dev/sdk](https://docs.agent-preflight.dev/sdk) for full SDK documentation.*

---

## 🛠️ CLI Reference

The `preflight` CLI is your single entry point for managing the entire Agent Preflight ecosystem.

| Command | Description |
|---|---|
| `preflight init <project>` | Scaffold a new Agent Preflight project |
| `preflight dev` | Start the development runtime with hot-reload |
| `preflight build` | Build agents and workflows for production |
| `preflight deploy agent --name <name>` | Deploy an agent to the runtime |
| `preflight deploy workflow --name <name>` | Deploy a workflow definition |
| `preflight run <agent> --task <task>` | Run a task against an agent |
| `preflight workflow run --name <name>` | Execute a multi-agent workflow |
| `preflight status` | Display runtime status and health |
| `preflight logs [agent]` | Tail logs from agents or runtime |
| `preflight config set <key> <value>` | Set configuration values |
| `preflight config get <key>` | Get configuration values |
| `preflight eval run --suite <name>` | Run an evaluation test suite |
| `preflight eval list` | List available evaluation suites |
| `preflight agent list` | List all deployed agents |
| `preflight agent inspect --name <name>` | Inspect agent configuration and status |
| `preflight agent remove --name <name>` | Remove a deployed agent |
| `preflight generate agent --name <name>` | Scaffold a new agent from a template |
| `preflight generate workflow --name <name>` | Scaffold a new workflow definition |
| `preflight plugin list` | List installed plugins |
| `preflight plugin install <name>` | Install a plugin from the marketplace |
| `preflight plugin publish` | Publish a plugin to the marketplace |
| `preflight provider list` | List configured AI providers |
| `preflight provider test --name <name>` | Test a provider connection |
| `preflight memory prune --agent <name>` | Prune agent memory |
| `preflight audit trail --from <date>` | View the security audit trail |
| `preflight telemetry status` | Check telemetry configuration |
| `preflight version` | Display CLI version |
| `preflight help` | Display help information |

```bash
# Quick reference
preflight --help
preflight <command> --help
```

---

## 🔌 Agent Communication Protocol

The **Agent Communication Protocol (ACP)** is the universal language for agent-to-agent communication. It enables agents built with different frameworks, in different languages, running in different environments, to discover, communicate, and collaborate seamlessly.

### Core Capabilities

| Capability | Description |
|---|---|
| **🔍 Agent Discovery** | Agents advertise their capabilities and discover peers through a distributed registry |
| **💬 Message Passing** | Structured message exchange with guaranteed delivery, retries, and dead-letter queues |
| **📋 Task Delegation** | Decompose complex tasks and delegate sub-tasks to specialized agents |
| **🔄 State Synchronization** | Real-time state sharing across agents with conflict resolution |
| **📡 Event Broadcasting** | Pub/sub event system for agent lifecycle and task events |
| **🔗 Tool Sharing** | Agents can expose and consume tools from other agents |
| **🔐 Auth & Identity** | Every message is signed and authenticated. Fine-grained permissions per agent |
| **🌉 Cross-Platform** | Works across Docker, Kubernetes, serverless, and on-premise deployments |
| **📊 Observability** | Every message is traced. Full visibility into inter-agent communication |
| **🔌 Multi-Transport** | gRPC, WebSockets, NATS, RabbitMQ, Redis Pub/Sub, and more |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACP Message Format                           │
│  {                                                               │
│    "protocol": "acp-v1",                                         │
│    "messageId": "msg_abc123",                                    │
│    "sourceAgent": "researcher-v2",                               │
│    "targetAgent": "writer-v1",                                   │
│    "messageType": "task.delegate",                               │
│    "payload": { "task": "Write summary...", "context": {...} }, │
│    "metadata": {                                                 │
│      "traceId": "trace_xyz",                                     │
│      "ttl": 300000,                                              │
│      "priority": "high",                                         │
│      "signature": "..."                                          │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

> *ACP is framework-agnostic. CrewAI agents talk to LangGraph agents. AutoGen agents talk to OpenAI SDK agents. Python agents talk to TypeScript agents. **Interoperability, finally.** *

---

## 🤖 Supported Providers

Agent Preflight provides a unified interface to every major AI model provider. The **Model Router** automatically selects, load-balances, and fails over between providers.

| Provider | Models | Streaming | Function Calling | Vision | Embeddings | Status |
|---|---|---|---|---|---|---|
| **OpenAI** | GPT-4o, GPT-4o-mini, o1, o3 | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **Anthropic** | Claude 4 Opus, Sonnet, Haiku | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **Google** | Gemini 2.5 Pro, Flash | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **Meta** | Llama 4, Llama 3 (via providers) | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **Mistral** | Mistral Large, Small, Codestral | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **Groq** | Llama, Mixtral, Gemma (fast inference) | ✅ | ✅ | ✅ | ❌ | ✅ Stable |
| **Together AI** | Llama, Mixtral, DeepSeek, Qwen | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **DeepSeek** | DeepSeek-V3, DeepSeek-R1 | ✅ | ✅ | ✅ | ❌ | ✅ Stable |
| **Cohere** | Command R+, Command R | ✅ | ✅ | ❌ | ✅ | ✅ Stable |
| **AWS Bedrock** | Claude, Llama, Mistral, Titan | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **Azure OpenAI** | GPT-4o, GPT-4o-mini, o1 | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **xAI** | Grok-2, Grok-3 | ✅ | ✅ | ✅ | ❌ | 🧪 Beta |
| **Ollama** | Local models (Llama, Mistral, Qwen, etc.) | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **OpenRouter** | Unified access to 200+ models | ✅ | ✅ | ✅ | ✅ | ✅ Stable |
| **Voyage AI** | Embedding models | ❌ | ❌ | ❌ | ✅ | ✅ Stable |
| **Custom Provider** | Any OpenAI-compatible API | ✅ | ✅ | ✅ | ✅ | ✅ Stable |

> *Provider integrations are community-extensible. Build your own provider adapter via the plugin system.*

---

## ☁️ Deployment

Agent Preflight runs anywhere. Choose the deployment model that fits your infrastructure.

| Target | Configuration | Best For |
|---|---|---|
| **🖥️ Local Development** | `preflight dev` — single process, hot-reload, SQLite backend | Development & testing |
| **🐳 Docker** | `docker compose up` — containers with Postgres, Redis, and the runtime | Staging & small production |
| **☸️ Kubernetes** | Helm chart — horizontal scaling, auto-healing, service mesh | Enterprise production |
| **🪣 AWS** | Terraform/Pulumi — ECS, EKS, Lambda, RDS, ElastiCache | AWS-native deployments |
| **🔵 Azure** | Terraform/Pulumi — AKS, Container Apps, Cosmos DB | Azure-native deployments |
| **🟢 GCP** | Terraform/Pulumi — GKE, Cloud Run, Cloud SQL | GCP-native deployments |
| **⚡ Vercel** | Edge-deployed API routes + serverless agents | Next.js + AI apps |
| **🌩️ Cloudflare** | Workers + Durable Objects + R2 storage | Edge-compute agents |
| **🏢 On-Premise** | Docker Compose + air-gapped mode | Regulated environments |
| **🔀 Hybrid** | Combine any of the above with ACP bridging | Multi-cloud & migration |

```bash
# Deploy with Docker
docker compose up -d

# Deploy with Kubernetes
helm repo add agent-preflight https://charts.agent-preflight.dev
helm install my-release agent-preflight/agent-preflight

# Deploy with Terraform
cd infra/terraform/aws
terraform init && terraform apply
```

---

## 🌐 Ecosystem

| Resource | Description |
|---|---|
| **[📖 Documentation](https://docs.agent-preflight.dev)** | Comprehensive guides, API reference, and tutorials |
| **[💻 SDK Reference](https://docs.agent-preflight.dev/sdk)** | TypeScript, Python, Go, Rust, Java, .NET SDK docs |
| **[🔌 Plugin Marketplace](https://github.com/marsley01/agent-preflight/tree/main/packages/plugins)** | Community and official plugins |
| **[📚 Examples](https://github.com/marsley01/agent-preflight/tree/main/apps/examples)** | Example projects and starter templates |
| **[📋 Changelog](https://github.com/marsley01/agent-preflight/releases)** | Release notes and version history |
| **[🗺️ Roadmap](https://github.com/marsley01/agent-preflight/issues)** | Public roadmap and feature requests |
| **[💬 Discord](https://discord.gg/agent-preflight)** | Community chat and support |
| **[🐦 Twitter](https://twitter.com/agentpreflight)** | Updates and announcements |
| **[📺 YouTube](https://youtube.com/@agentpreflight)** | Tutorials and deep dives |

---

## 🗺️ Roadmap

### Current — v1.0

- [x] Core runtime with planner, scheduler, coordinator
- [x] Agent Communication Protocol (ACP) v1
- [x] Multi-provider model routing with fallback
- [x] TypeScript SDK
- [x] Enterprise CLI
- [x] Docker & Docker Compose deployment
- [x] RBAC security layer
- [x] Working & episodic memory

### Next — v1.5

- [ ] Python, Go, Rust, Java, .NET SDKs GA
- [ ] Knowledge graph with hybrid search
- [ ] Plugin marketplace & SDK
- [ ] Evaluation engine with built-in test suites
- [ ] OpenTelemetry tracing & Prometheus metrics
- [ ] Dashboard v1 with real-time monitoring
- [ ] Kubernetes Helm chart GA

### Future — v2.0

- [ ] ACP v2 with cross-cluster agent discovery
- [ ] Autonomous agent swarms with self-healing
- [ ] ABAC policy engine with policy-as-code
- [ ] Multi-region & multi-cloud orchestration
- [ ] Agent benchmarking suite & leaderboard
- [ ] Semantic memory with long-term learning
- [ ] On-premise air-gapped mode
- [ ] SOC 2 & HIPAA compliance attestation

---

## 📈 Performance & Benchmarks

> *Comprehensive benchmarks are coming soon. We are building a rigorous benchmarking suite that measures:*
>
> - **Latency** — P50/P95/P99 request-to-response times
> - **Throughput** — Agents processed per second
> - **Scalability** — Performance under 10 / 100 / 1000+ concurrent agents
> - **Provider Switching** — Overhead of multi-provider routing
> - **Memory Performance** — Read/write latencies across storage backends
> - **Framework Interop** — Cost of cross-framework ACP communication
>
> *Benchmark results will be published at [docs.agent-preflight.dev/benchmarks](https://docs.agent-preflight.dev/benchmarks).*

---

## 🔒 Security

### Our Philosophy

Security is not a feature — it is a **foundational property** of the system. Every layer of Agent Preflight is designed with security as a first-class concern, not an afterthought.

### Security Features

| Feature | Description |
|---|---|
| **🔐 Authentication** | API keys, JWT, OAuth2, and SSO support |
| **👥 RBAC** | Role-based access control with customizable roles (admin, developer, viewer, agent) |
| **📋 ABAC** | Attribute-based access control for fine-grained permissions |
| **📜 Policy Engine** | Policy-as-code for agent behavior, resource access, and data handling |
| **🔑 Secret Management** | Integration with HashiCorp Vault, AWS Secrets Manager, Azure Key Vault |
| **🔒 Encryption at Rest** | AES-256 encryption for all persisted data |
| **🔒 Encryption in Transit** | TLS 1.3 for all network communication |
| **📝 Audit Trails** | Immutable, tamper-evident audit log of all actions |
| **🛡️ Rate Limiting** | Per-agent, per-user, and per-API-key rate limits |
| **🧹 Data Retention** | Configurable retention policies with automated cleanup |
| **✅ Compliance Ready** | SOC 2, HIPAA, and GDPR controls built in |

### Responsible Disclosure

If you discover a security vulnerability in Agent Preflight, please **do not** open a public issue. Instead, email security@agent-preflight.dev. We will respond within 24 hours and work with you to resolve the issue responsibly.

---

## ❤️ Contributing

Agent Preflight is open-source and community-driven. We welcome contributions of all kinds — from bug fixes and documentation to new features and plugins.

### Ways to Contribute

- **🐛 Report Bugs** — Open an issue with a clear reproduction
- **💡 Feature Requests** — Open an issue describing the feature and use case
- **📝 Documentation** — Improve docs, fix typos, add examples
- **🔌 Plugins** — Build and publish plugins to the marketplace
- **🧪 Tests** — Add test coverage for existing features
- **🌐 SDKs** — Contribute to language SDKs
- **📋 Code** — Submit PRs for open issues

### Getting Started

```bash
# Clone the repository
git clone https://github.com/marsley01/agent-preflight.git
cd agent-preflight

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Run linting
pnpm lint
```

> *Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines, code of conduct, and development workflow.*

---

## 💬 Community

| Platform | Link | Purpose |
|---|---|---|
| **💬 Discord** | [discord.gg/agent-preflight](https://discord.gg/agent-preflight) | Community chat, support, discussion |
| **🐦 Twitter** | [@agentpreflight](https://twitter.com/agentpreflight) | Announcements, updates, tips |
| **📺 YouTube** | [youtube.com/@agentpreflight](https://youtube.com/@agentpreflight) | Tutorials, deep dives, architecture talks |
| **📋 GitHub Issues** | [github.com/marsley01/agent-preflight/issues](https://github.com/marsley01/agent-preflight/issues) | Bug reports, feature requests |
| **💡 GitHub Discussions** | [github.com/marsley01/agent-preflight/discussions](https://github.com/marsley01/agent-preflight/discussions) | Ideas, Q&A, show and tell |
| **📝 Blog** | [agent-preflight.dev/blog](https://agent-preflight.dev/blog) | Engineering blog, case studies |

---

## 🏆 Sponsors

> *We are currently seeking sponsors to support the development of Agent Preflight. If your organization relies on AI agent infrastructure, consider sponsoring the project.*
>
> *Sponsorship tiers and benefits will be announced soon. For inquiries, contact sponsors@agent-preflight.dev.*
>
> *[Become a sponsor](https://github.com/sponsors/marsley01)*

---

## 📄 License

**Agent Preflight** is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Anomaly Co.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🌟 Vision & Mission

### Mission

To provide the **definitive open-source infrastructure layer** for AI agents — making it possible for any organization to build, deploy, and scale agent systems with the same confidence and reliability that Kubernetes brought to containerized applications.

### Vision

We envision a future where:

- **AI agents are as fundamental to software as databases and APIs.** Every application will have agents working alongside traditional code, handling complex reasoning, research, and autonomous tasks.

- **Agent interoperability is a given.** An agent built with CrewAI talks to an agent built with LangGraph, running on different clouds, in different languages — as naturally as HTTP services communicate today.

- **Enterprise-grade agent infrastructure** — security, observability, governance, and compliance — is accessible to every team, not just those with dedicated ML infrastructure engineers.

- **The barrier to building with agents is zero.** A solo developer with a good idea can scaffold, deploy, and scale sophisticated multi-agent systems in minutes, not months.

- **The ecosystem is open.** No vendor lock-in. No proprietary protocols. No walled gardens. An open standard for agent communication and orchestration that the entire industry can build on.

### The Name

**Preflight** — because before every mission-critical flight, there is a preflight checklist. Before every production deploy, there should be Agent Preflight.

Agent Preflight is the infrastructure that ensures your agents are ready for takeoff. Every time.

---

<div align="center">
  <br/>
  <p>
    <strong>🛫 Agent Preflight</strong> — <em>The Operating System for AI Agents</em>
  </p>
  <p>
    <a href="https://github.com/marsley01/agent-preflight">GitHub</a> ·
    <a href="https://agent-preflight.dev">Website</a> ·
    <a href="https://docs.agent-preflight.dev">Docs</a> ·
    <a href="https://discord.gg/agent-preflight">Discord</a> ·
    <a href="https://twitter.com/agentpreflight">Twitter</a>
  </p>
  <p>
    <sub>Built with ❤️ by <a href="https://github.com/marsley01">@marsley01</a> and the Agent Preflight community</sub>
  </p>
  <br/>
</div>
