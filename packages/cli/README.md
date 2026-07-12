# @preflight-agent/cli

A fast, interactive pre-deploy security scanner for web developers. Run security checks locally before pushing to GitHub.

## Features

- **Security Audits:** Scans for hardcoded secrets, API keys, and insecure configurations.
- **Vulnerability Checks:** Detects dangerous patterns like `eval()`, XSS risks, and insecure headers.
- **Authentication & Authorization:** Checks for missing middleware, Row Level Security (RLS) configurations, and more.
- **Instant Results:** Fast, local scanning directly in your terminal.

## Installation

```bash
npm install -g @preflight-agent/cli
```

## Usage

To scan your current directory:

```bash
preflight scan .
```

To scan a specific directory:

```bash
preflight scan ./path/to/project
```

## About

`preflight` helps you catch common security mistakes that AI coding tools and fast-paced development can overlook. Designed for "vibe coders" who want to ship fast without sacrificing security.
