# 🛫 agent-preflight

> Pre-deploy checklists and rules for AI coding agents.
> Built for builders who ship with AI tools — not CS textbooks.

---

## What this is

You are building with Cursor, Copilot, Claude, or any AI coding agent. You move fast. But fast without guardrails means broken auth, leaked secrets, silent errors, and payment bugs in production.

**agent-preflight** is a library of rules you hand to your AI agent before it ships anything. The agent reads the relevant file, runs the checks, fixes what is broken, and gives you a pass/fail report. You do not need to know every detail of software engineering. The rules know it for you.

---

## How to use

### Option 1 — Paste into your agent prompt
Copy any rule file and paste it at the top of your Cursor / Claude / Copilot prompt:

```
Read this rule and treat it as mandatory before doing anything.

[paste rule content here]
```

### Option 2 — Reference by raw URL
Tell your agent to fetch it directly:

```
Before starting, download and follow this rule:
https://raw.githubusercontent.com/marsley01/agent-preflight/main/rules/scope-lock.mdc
```

### Option 3 — Install via cursor.directory
Search for **agent-preflight** on [cursor.directory](https://cursor.directory) and install directly into Cursor.

---

## Rule library

| Rule | What it does |
|---|---|
| [`pre-deploy-checklist.mdc`](./rules/pre-deploy-checklist.mdc) | Full pre-deploy gate — build, security, auth, DB, error handling, rate limiting, payments, real-time cleanup |
| [`scope-lock.mdc`](./rules/scope-lock.mdc) | Stops agents expanding beyond what was asked — no surprise refactors |
| [`session-kickstart.mdc`](./rules/session-kickstart.mdc) | Fixes the cold start problem — forces agents to read the project before touching anything |
| [`db-migration-safety.mdc`](./rules/db-migration-safety.mdc) | Schema change gate — rollback plans, index checks, two-deploy rule for destructive changes |
| [`code-review.mdc`](./rules/code-review.mdc) | Mechanical bug checklist — N+1 queries, unhandled promises, stale closures, missing error states |
| [`dependency-hygiene.mdc`](./rules/dependency-hygiene.mdc) | Think before you install — catches duplicates, abandoned packages, and missing npm audit |
| [`api-contract.mdc`](./rules/api-contract.mdc) | One response shape across every route — kills the `{data}` vs `{result}` vs `{message}` chaos |
| [`context-window-management.mdc`](./rules/context-window-management.mdc) | Stops hallucination on large codebases — forces checkpoints and clean handoffs at context limit |
| [`naming-contract.mdc`](./rules/naming-contract.mdc) | One naming convention everywhere — catches names that lie about what they actually do |

---

## Stack this was built for

Works with any stack. Purpose-built defaults for:
- **Next.js** (App Router + Pages Router)
- **Supabase** (Auth, RLS, Realtime)
- **Stripe / Paystack / M-Pesa / Razorpay / Paddle**
- **Stream Chat / Stream Video**
- **Prisma / DrizzleORM**
- **Upstash Redis**
- **Vercel / Railway / Render / Fly.io**

---

## Who this is for

- Solo founders building full-stack apps with AI agents
- Vibe coders who understand the product but not every layer of the stack
- Small teams who want a shared quality standard without a dedicated DevOps engineer
- Anyone tired of shipping bugs that a 10-minute checklist would have caught

---

## Contributing

Found a check that should be here? Open a PR.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for the format.

---

## License

MIT — use it, fork it, paste it into your agent prompts freely.

---

*Started by [@marsley01](https://github.com/marsley01)*
