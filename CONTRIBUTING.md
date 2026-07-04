# Contributing to agent-preflight

Thanks for wanting to add to this. The goal is simple: every file in this repo should make an AI agent a better engineer.

---

## What belongs here

- **Checklists** — step-by-step gates an agent runs before or during a task
- **Skills** — opinionated guides for a specific domain (e.g. "how to write secure Supabase RLS policies")
- **Patterns** — reusable code patterns an agent should prefer over common mistakes

If it makes an AI agent catch bugs it would normally miss, it belongs here.

---

## File format

Every skill file must start with a frontmatter block:

```
---
name: your-skill-name
description: One sentence on what this covers and when to use it.
stack: next.js, supabase, etc (or "any")
---
```

Then write the skill in plain language the agent can follow.
Use concrete examples. Use code blocks where it helps.
Avoid vague advice like "handle errors properly" — show the pattern.

---

## PR rules

- One skill per PR
- Test it: paste it into your agent and run it on a real project before submitting
- If it is stack-specific, note the stack clearly in the frontmatter
- Keep it honest — if a check is hard to automate, say so

---

## Folder structure

```
agent-preflight/
├── checklists/    # Pass/fail gates the agent runs
└── skills/        # Domain-specific guidance files
```

---

Open a PR. Roast the existing checklist if something is missing. That is how this gets better.

