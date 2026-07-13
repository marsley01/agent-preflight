"""AI framework release feed fetcher — monitors PyPI and npm for new releases of key AI packages."""

import httpx
from typing import Any
import re

# Core AI/ML packages to monitor
AI_PACKAGES = {
    "pypi": [
        "openai", "anthropic", "langchain", "langchain-core", "langgraph",
        "llamaindex", "haystack-ai", "transformers", "sentence-transformers",
        "chromadb", "pinecone-client", "weaviate-client", "qdrant-client",
        "pydantic", "pydantic-ai", "instructor",
    ],
    "npm": [
        "openai", "@anthropic-ai/sdk", "langchain", "@langchain/core",
        "llamaindex", "chromadb", "pinecone-client", "ai",
        "vectordb", "zod", "zod-validation-error",
    ],
}

PYPI_URL = "https://pypi.org/pypi/{package}/json"
NPM_URL = "https://registry.npmjs.org/{package}"


async def fetch_pypi_releases(package: str) -> list[dict[str, Any]]:
    """Fetch recent releases for a PyPI package."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(PYPI_URL.format(package=package))
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    releases = []
    info = data.get("info", {})
    for version, files in sorted(data.get("releases", {}).items(), reverse=True)[:5]:
        if not files:
            continue
        upload_time = files[0].get("upload_time", "")
        releases.append({
            "package": f"pypi:{package}",
            "vulnerability_type": "release",
            "cve_id": f"release-{package}-{version}",
            "severity": "info",
            "description": f"New release: {package} v{version} — {info.get('summary', '')[:200]}",
            "fix_snippet": f"Upgrade to {package}=={version}",
            "source": "pypi",
            "published": upload_time,
        })
    return releases


async def fetch_npm_releases(package: str) -> list[dict[str, Any]]:
    """Fetch recent releases for an npm package."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(NPM_URL.format(package=package))
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    releases = []
    dist_tags = data.get("dist-tags", {})
    for version in list(dist_tags.values())[:5]:
        time_info = data.get("time", {})
        upload_time = time_info.get(version, "")

        releases.append({
            "package": f"npm:{package}",
            "vulnerability_type": "release",
            "cve_id": f"release-{package}-{version}",
            "severity": "info",
            "description": f"New release: {package} v{version}",
            "fix_snippet": f"npm install {package}@{version}",
            "source": "npm",
            "published": upload_time,
        })
    return releases


async def fetch_all_ai_feeds() -> list[dict[str, Any]]:
    """Fetch all AI framework release updates."""
    results = []

    for pkg in AI_PACKAGES["pypi"]:
        results.extend(await fetch_pypi_releases(pkg))

    for pkg in AI_PACKAGES["npm"]:
        results.extend(await fetch_npm_releases(pkg))

    return results
