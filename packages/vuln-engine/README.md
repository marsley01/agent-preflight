# vuln-engine

A small FastAPI service that collects live threat intelligence (recent CVEs, GitHub Security Advisories and AI-framework releases) into one cached JSON API. It can also draft AI-generated fix instructions for a finding.

It is **optional and self-hosted**. The CLI and the web UI don't call it today. The CLI gets dependency advisories straight from [OSV.dev](https://osv.dev).

## Run it

Requires Python 3.10+ (CI runs 3.12).

```bash
cd packages/vuln-engine
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py                    # http://127.0.0.1:8412
```

On startup it fills the cache, then refreshes every 5 minutes.

For production, run it behind a process manager instead of `python main.py`:

```bash
uvicorn main:app --host 0.0.0.0 --port 8412 --workers 1
```

Use a single worker. The cache lives in memory, so each worker would keep its own copy and poll the upstream APIs separately.

## Configuration

All settings are environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PREFLIGHT_API_KEY` | *(unset)* | Shared secret required as the `X-API-Key` header on `POST /v1/fix` and `POST /v1/refresh`. **If unset, those endpoints only accept requests from localhost.** Set it for any deployment reachable from other machines |
| `ALLOWED_ORIGINS` | `http://localhost:5173,https://preflight-agent.vercel.app` | Comma-separated browser origins allowed by CORS |
| `GITHUB_TOKEN` | *(unset)* | Required for GitHub Security Advisories, because GitHub's GraphQL API rejects anonymous requests. Without it, that source is empty. A token with no scopes is enough |
| `OPENAI_API_KEY` | *(unset)* | Enables `POST /v1/fix`. Without it, the endpoint returns a placeholder response |
| `HOST` | `127.0.0.1` | Bind address for `python main.py` |
| `PORT` | `8412` | Port for `python main.py` |
| `RELOAD` | *(unset)* | Set to `1` for auto-reload during development |

## API

Interactive docs are served at `/docs` (Swagger UI) while the server runs.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Liveness, plus item counts per source |
| `GET` | `/v1/intelligence?limit=50&source=&severity=` | — | Cached items, newest first. `source`: `nvd`, `github_advisory`, `pypi`, `npm`. `severity`: `critical`, `high`, `medium`, `low`, `info` |
| `GET` | `/v1/search?q=langchain&limit=20` | — | Live keyword search across NVD and GitHub advisories (`q` is at most 200 characters) |
| `POST` | `/v1/refresh` | API key | Force a cache refresh. At most once every 60 seconds; otherwise returns `429` |
| `POST` | `/v1/fix` | API key | Generate fix guidance with OpenAI (`gpt-4o`) |

Example:

```bash
curl -s http://127.0.0.1:8412/v1/intelligence?severity=critical&limit=5

curl -s -X POST http://127.0.0.1:8412/v1/fix \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $PREFLIGHT_API_KEY" \
  -d '{"error_log": "SQL built with string interpolation", "affected_code": "db.query(`SELECT * FROM users WHERE id = ${id}`)", "file_path": "lib/db.ts", "tech_stack": "Next.js, Postgres"}'
```

`/v1/fix` fields and their limits: `error_log` (8,000 characters), `affected_code` (16,000), `file_path` (500) and `tech_stack` (500). The response contains `root_cause`, `coder_agent_prompt`, `verification_steps[]`, `documentation_links[]`, `model_used` and `source`.

> **Privacy:** `/v1/fix` sends the submitted code and error log to OpenAI. Don't submit code you can't share with a third party.

## Data sources

| Source | Module | Notes |
|---|---|---|
| NVD (CVE 2.0 API) | `fetchers/nvd.py` | CVEs from the last 7 days. Unauthenticated, so NVD's public rate limit applies |
| GitHub Security Advisories | `fetchers/github_advisories.py` | Needs `GITHUB_TOKEN` |
| PyPI and npm registries | `fetchers/ai_feeds.py` | Recent releases of the AI and vector-DB packages listed in `AI_PACKAGES` |

Items are de-duplicated by CVE ID and sorted by publish date.
