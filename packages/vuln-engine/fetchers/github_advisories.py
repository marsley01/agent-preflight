"""GitHub Security Advisory fetcher via GraphQL API."""

import httpx
from typing import Any


GITHUB_GRAPHQL = "https://api.github.com/graphql"

# GitHub Advisory queries for ecosystem-specific and general advisories
GLOBAL_ADVISORIES_QUERY = """
query($first: Int!, $after: String) {
  securityAdvisories(first: $first, after: $after, orderBy: { field: PUBLISHED_AT, direction: DESC }) {
    nodes {
      ghsaId
      summary
      description
      severity
      publishedAt
      vulnerabilities(first: 5) {
        nodes {
          package {
            name
            ecosystem
          }
          vulnerableVersionRange
          firstPatchedVersion { identifier }
        }
      }
      references { url }
    }
    pageInfo { endCursor hasNextPage }
  }
}
"""


async def fetch_recent_advisories(token: str | None = None, max_results: int = 50) -> list[dict[str, Any]]:
    """Fetch recent GitHub Security Advisories."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                GITHUB_GRAPHQL,
                json={"query": GLOBAL_ADVISORIES_QUERY, "variables": {"first": max_results}},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    results = []
    advisory_data = data.get("data", {}).get("securityAdvisories", {})
    for node in advisory_data.get("nodes", []):
        vulns = node.get("vulnerabilities", {}).get("nodes", [])

        packages = []
        fix_snippets = []
        for vuln in vulns:
            pkg = vuln.get("package", {})
            packages.append(f"{pkg.get('ecosystem', '')}:{pkg.get('name', 'unknown')}")
            patched = vuln.get("firstPatchedVersion", {})
            if patched:
                fix_snippets.append(f"Upgrade to {patched.get('identifier', 'latest')}")

        results.append({
            "package": ", ".join(packages) if packages else "unknown",
            "vulnerability_type": "advisory",
            "cve_id": node.get("ghsaId", ""),
            "severity": (node.get("severity", "unknown") or "unknown").lower(),
            "description": (node.get("description", "") or node.get("summary", ""))[:500],
            "fix_snippet": "; ".join(fix_snippets) if fix_snippets else "Check advisory for fix",
            "source": "github_advisory",
            "published": node.get("publishedAt", ""),
        })

    return results


async def search_advisories(query: str, token: str | None = None) -> list[dict[str, Any]]:
    """Search GitHub advisories by keyword."""
    SEARCH_QUERY = """
    query($query: String!, $first: Int!) {
      securityAdvisories(first: $first, query: $query, orderBy: { field: PUBLISHED_AT, direction: DESC }) {
        nodes {
          ghsaId
          summary
          description
          severity
          publishedAt
          vulnerabilities(first: 3) {
            nodes {
              package { name ecosystem }
              vulnerableVersionRange
              firstPatchedVersion { identifier }
            }
          }
        }
      }
    }
    """
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                GITHUB_GRAPHQL,
                json={"query": SEARCH_QUERY, "variables": {"query": query, "first": 20}},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

    results = []
    for node in data.get("data", {}).get("securityAdvisories", {}).get("nodes", []):
        pkg_names = []
        for v in node.get("vulnerabilities", {}).get("nodes", []):
            p = v.get("package", {})
            pkg_names.append(f"{p.get('ecosystem', '')}:{p.get('name', '')}")

        results.append({
            "package": ", ".join(pkg_names) if pkg_names else query,
            "vulnerability_type": "advisory",
            "cve_id": node.get("ghsaId", ""),
            "severity": (node.get("severity", "unknown") or "unknown").lower(),
            "description": (node.get("description", "") or node.get("summary", ""))[:500],
            "fix_snippet": "",
            "source": "github_advisory",
            "published": node.get("publishedAt", ""),
        })

    return results
