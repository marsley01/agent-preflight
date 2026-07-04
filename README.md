# 🛫 agent-preflight

> Pre-deploy checklists and skill files for AI coding agents.
> Built for builders who ship with AI tools — not CS textbooks.

---

## What this is

You are building with Cursor, Copilot, Claude, Antigravity, or any AI coding agent.
You move fast. But fast without guardrails means broken auth, leaked secrets, silent errors, and payment bugs in production.

**agent-preflight** is a library of skill files you hand to your AI agent before it ships anything.
The agent reads the relevant file, runs the checks, fixes what is broken, and gives you a pass/fail report.
You do not need to know every detail of software engineering. The skill files know it for you.

---

## How to use

### Option 1 — Paste into your agent prompt
Copy the relevant skill file and paste it at the top of your Cursor / Claude / Copilot prompt:

```
Read this checklist and treat it as mandatory. 
After completing your task, run every section and output the final summary table.
Do not say done until all rows show PASS.

[paste skill file content here]
```

### Option 2 — Reference by URL
Tell your agent to fetch it directly:

```
Before shipping, download and follow this checklist:
https://raw.githubusercontent.com/marsley01/agent-preflight/main/checklists/pre-deploy.md
```

---

## Skill library

| File | What it covers |
|---|---|
| [`checklists/pre-deploy.md`](./checklists/pre-deploy.md) | Full pre-deploy gate: build, security, auth, DB, error handling, rate limiting, payments, real-time cleanup, deploy readiness |

More skills coming. PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Stack this was built for

Works with any stack. Purpose-built defaults for:
- **Next.js** (App Router + Pages Router)
- **Supabase** (Auth, RLS, Realtime)
- **Prisma**
- **Paystack** + **M-Pesa / Daraja**
- **Stream Chat / Stream Video**
- **Upstash Redis**
- **Vercel / Railway / Render**

---

## Who this is for

- Solo founders building full-stack apps with AI agents
- Vibe coders who understand the product but not every layer of the stack
- Small teams who want a shared quality standard without a dedicated DevOps person
- Anyone tired of shipping bugs that a 10-minute checklist would have caught

---

## Contributing

Found a check that should be here? Open a PR.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for the format.

---

## License

MIT — use it, fork it, paste it into your agent prompts freely.

---

*Started by [@marsley01](https://github.com/marsley01) — building in Nairobi 🇰🇪*

