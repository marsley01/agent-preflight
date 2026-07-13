"""Agent Preflight — Vulnerability Research Engine
FastAPI server that aggregates live threat intelligence from NVD, GitHub Advisories,
and AI framework release feeds, structures it, and exposes it as a JSON API.
"""

import asyncio
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
    token = None  # Optional: set GITHUB_TOKEN env var for higher rate limits
    import os
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
    token = None
    import os
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
# Entry
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8412, reload=True)
