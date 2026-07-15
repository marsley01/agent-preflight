"""Agent Preflight — Vulnerability Research Engine
FastAPI server that aggregates live threat intelligence from NVD, GitHub Advisories,
and AI framework release feeds, structures it, and exposes it as a JSON API.
"""

import asyncio
import os
from typing import Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fetchers.nvd import fetch_recent_cves, search_cve
from fetchers.github_advisories import fetch_recent_advisories, search_advisories
from fetchers.ai_feeds import fetch_all_ai_feeds

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------
_cache: dict[str, Any] = {
    "cves": [],
    "advisories": [],
    "ai_feeds": [],
    "combined": [],
}
_cache_lock = asyncio.Lock()
UPDATE_INTERVAL = 300  # refresh every 5 minutes


async def refresh_cache():
    """Pull fresh data from all sources and merge into cache."""
    token = os.environ.get("GITHUB_TOKEN")

    cves, advisories, feeds = await asyncio.gather(
        fetch_recent_cves(days_back=7, max_results=50),
        fetch_recent_advisories(token=token, max_results=50),
        fetch_all_ai_feeds(),
    )

    async with _cache_lock:
        _cache["cves"] = cves
        _cache["advisories"] = advisories
        _cache["ai_feeds"] = feeds

        combined = []
        seen = set()
        for item in cves + advisories + feeds:
            key = item.get("cve_id", "")
            if key and key not in seen:
                seen.add(key)
                combined.append(item)
        combined.sort(key=lambda x: x.get("published", ""), reverse=True)
        _cache["combined"] = combined

    return len(combined)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background refresh task on server startup."""
    task = asyncio.create_task(_periodic_refresh())
    yield
    task.cancel()


async def _periodic_refresh():
    """Refresh cache every UPDATE_INTERVAL seconds."""
    await refresh_cache()
    while True:
        await asyncio.sleep(UPDATE_INTERVAL)
        await refresh_cache()


app = FastAPI(
    title="Agent Preflight — Vulnerability Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class VulnItem(BaseModel):
    package: str
    vulnerability_type: str
    cve_id: str
    severity: str
    description: str
    fix_snippet: str
    source: str
    published: str


class VulnListResponse(BaseModel):
    total: int
    items: list[VulnItem]
    source_counts: dict[str, int]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    async with _cache_lock:
        return {
            "status": "ok",
            "cache_size": len(_cache["combined"]),
            "cves": len(_cache["cves"]),
            "advisories": len(_cache["advisories"]),
            "ai_feeds": len(_cache["ai_feeds"]),
        }


@app.get("/v1/intelligence", response_model=VulnListResponse)
async def get_intelligence(
    limit: int = Query(50, ge=1, le=200),
    source: str | None = Query(None, description="Filter by source: nvd, github_advisory, pypi, npm"),
    severity: str | None = Query(None, description="Filter by severity: critical, high, medium, low, info"),
):
    """Get the latest aggregated threat intelligence."""
    async with _cache_lock:
        items = _cache["combined"]

    if source:
        items = [i for i in items if i.get("source") == source]
    if severity:
        items = [i for i in items if i.get("severity") == severity]

    source_counts: dict[str, int] = {}
    for i in items:
        src = i.get("source", "unknown")
        source_counts[src] = source_counts.get(src, 0) + 1

    return VulnListResponse(
        total=len(items),
        items=[VulnItem(**i) for i in items[:limit]],
        source_counts=source_counts,
    )


@app.get("/v1/search", response_model=VulnListResponse)
async def search_intelligence(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Search intelligence by keyword across all sources."""
    token = os.environ.get("GITHUB_TOKEN")

    cves, advisories = await asyncio.gather(
        search_cve(q, max_results=limit // 2),
        search_advisories(q, token=token),
    )

    results = (cves + advisories)[:limit]
    return VulnListResponse(
        total=len(results),
        items=[VulnItem(**i) for i in results],
        source_counts={"nvd": len(cves), "github_advisory": len(advisories)},
    )


@app.post("/v1/refresh")
async def refresh():
    """Manually trigger a cache refresh."""
    count = await refresh_cache()
    return {"status": "ok", "items_refreshed": count}


# ---------------------------------------------------------------------------
# AI Fix Generation
# ---------------------------------------------------------------------------

class AiFixRequest(BaseModel):
    error_log: str = ""
    affected_code: str = ""
    file_path: str = ""
    tech_stack: str = ""


class AiFixResponse(BaseModel):
    root_cause: str
    coder_agent_prompt: str
    verification_steps: list[str]
    documentation_links: list[str]
    model_used: str = ""
    source: str = "openai"


@app.post("/v1/fix")
async def generate_fix(req: AiFixRequest):
    """Generate an AI-powered fix for a detected vulnerability."""
    api_key = os.environ.get("OPENAI_API_KEY")

    system_prompt = (
        "You are a senior security engineer. Given a vulnerability report, "
        "produce a concise, actionable fix in the following strict Markdown format. "
        "Do NOT include any commentary outside the sections.\n\n"
        "## Root Cause\n(Explain the root cause in 2-4 sentences.)\n\n"
        "## Coder Agent Prompt\n(Write a precise prompt a coder agent could follow to fix the issue. "
        "Include the file path, what to change, and the corrected code snippet.)\n\n"
        "## Verification Steps\n- Step 1\n- Step 2\n- Step 3\n\n"
        "## Documentation\n- [Relevant docs](url)"
    )

    user_prompt = (
        f"**Error / Issue**\n{req.error_log or '(none)'}\n\n"
        f"**Affected Code**\n```\n{req.affected_code or '(none)'}\n```\n\n"
        f"**File Path**\n{req.file_path or '(none)'}\n\n"
        f"**Tech Stack**\n{req.tech_stack or '(none)'}"
    )

    if not api_key:
        return AiFixResponse(
            root_cause="No OPENAI_API_KEY configured. This is a mock response. Set the environment variable to enable real AI fix generation.",
            coder_agent_prompt="n/a — API key not configured",
            verification_steps=["Set OPENAI_API_KEY environment variable", "Restart the vuln-engine service", "Re-run the fix generation"],
            documentation_links=["https://platform.openai.com/api-keys"],
            model_used="mock",
            source="mock",
        )

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=api_key)
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=2048,
        )
        content = resp.choices[0].message.content or ""
        model_used = resp.model

        lines = content.split("\n")
        root_cause = _extract_section(lines, "## Root Cause")
        coder_prompt = _extract_section(lines, "## Coder Agent Prompt")
        verification = _extract_list(lines, "## Verification Steps")
        docs = _extract_list(lines, "## Documentation")

        return AiFixResponse(
            root_cause=root_cause or "Could not parse root cause.",
            coder_agent_prompt=coder_prompt or "Could not parse coder agent prompt.",
            verification_steps=verification or ["See generated content above."],
            documentation_links=docs or [],
            model_used=model_used,
            source="openai",
        )
    except Exception as exc:
        return AiFixResponse(
            root_cause=f"AI generation failed: {exc}",
            coder_agent_prompt="n/a",
            verification_steps=["Check the vuln-engine logs for details"],
            documentation_links=[],
            model_used="error",
            source="error",
        )


def _extract_section(lines: list[str], heading: str) -> str:
    """Extract text under a Markdown heading until the next heading."""
    result: list[str] = []
    found = False
    for line in lines:
        if line.strip().startswith(heading):
            found = True
            continue
        if found:
            if line.strip().startswith("## "):
                break
            result.append(line)
    return "\n".join(result).strip()


def _extract_list(lines: list[str], heading: str) -> list[str]:
    """Extract list items under a Markdown heading."""
    items: list[str] = []
    found = False
    for line in lines:
        if line.strip().startswith(heading):
            found = True
            continue
        if found:
            if line.strip().startswith("## "):
                break
            stripped = line.strip()
            if stripped.startswith("- ") or stripped.startswith("* "):
                items.append(stripped[2:])
            elif stripped.startswith("-["):
                # markdown link like - [text](url)
                import re
                m = re.match(r"-\s*\[([^\]]+)\]\(([^)]+)\)", stripped)
                if m:
                    items.append(f"[{m.group(1)}]({m.group(2)})")
    return items


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8412, reload=True)
