"""NVD (National Vulnerability Database) API fetcher."""

import httpx
from typing import Any


NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"


async def fetch_recent_cves(days_back: int = 7, max_results: int = 50) -> list[dict[str, Any]]:
    """Fetch recent CVEs from the NVD API."""
    params = {
        "pubStartDate": _days_ago_iso(days_back),
        "pubEndDate": _now_iso(),
        "resultsPerPage": max_results,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(NVD_API_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    results = []
    for vuln in data.get("vulnerabilities", []):
        cve = vuln.get("cve", {})
        cve_id = cve.get("id", "")
        descriptions = cve.get("descriptions", [])
        description = ""
        for d in descriptions:
            if d.get("lang") == "en":
                description = d.get("value", "")
                break

        metrics = cve.get("metrics", {})
        severity = "UNKNOWN"
        for metric_key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            metric_list = metrics.get(metric_key, [])
            if metric_list:
                severity = metric_list[0].get("cvssData", {}).get("baseSeverity", "UNKNOWN")
                break

        # Extract affected packages from configurations
        configurations = cve.get("configurations", [])
        affected_packages = set()
        for config in configurations:
            for node in config.get("nodes", []):
                for match in node.get("cpeMatch", []):
                    criteria = match.get("criteria", "")
                    if ":" in criteria:
                        parts = criteria.split(":")
                        if len(parts) > 4:
                            vendor = parts[3]
                            product = parts[4]
                            affected_packages.add(f"{vendor}/{product}")

        results.append({
            "package": ", ".join(sorted(affected_packages)) if affected_packages else "unknown",
            "vulnerability_type": "cve",
            "cve_id": cve_id,
            "severity": severity.lower(),
            "description": description[:500],
            "fix_snippet": _extract_fix_hint(cve),
            "source": "nvd",
            "published": cve.get("published", ""),
        })

    return results


async def search_cve(query: str, max_results: int = 20) -> list[dict[str, Any]]:
    """Search CVEs by keyword."""
    params = {
        "keywordSearch": query,
        "resultsPerPage": max_results,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(NVD_API_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    results = []
    for vuln in data.get("vulnerabilities", []):
        cve = vuln.get("cve", {})
        descriptions = cve.get("descriptions", [])
        description = ""
        for d in descriptions:
            if d.get("lang") == "en":
                description = d.get("value", "")
                break

        results.append({
            "package": query,
            "vulnerability_type": "cve",
            "cve_id": cve.get("id", ""),
            "severity": "unknown",
            "description": description[:500],
            "fix_snippet": "",
            "source": "nvd",
            "published": cve.get("published", ""),
        })

    return results


def _extract_fix_hint(cve: dict) -> str:
    """Try to extract a fix hint from references."""
    refs = cve.get("references", [])
    for ref in refs:
        tags = ref.get("tags", [])
        if "Patch" in tags or "Vendor Advisory" in tags:
            return ref.get("url", "")
    return ""


def _days_ago_iso(days: int) -> str:
    from datetime import datetime, timedelta, timezone
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000")


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000")
