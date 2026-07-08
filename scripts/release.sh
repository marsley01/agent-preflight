#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Agent Preflight Release Script ==="

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Running CI checks..."
pnpm build
pnpm lint
pnpm typecheck
pnpm test

if [ "${CI:-}" != "true" ]; then
  echo ""
  echo "Creating changeset..."
  pnpm changeset

  echo ""
  echo "Versioning packages..."
  pnpm changeset version

  echo ""
  echo "Review the changes, then commit and push."
  echo "To publish: pnpm release"
else
  echo ""
  echo "Publishing to npm..."
  pnpm release
fi

echo "Release process complete."
