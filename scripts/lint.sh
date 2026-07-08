#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Linting Agent Preflight ==="

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Running linter..."
pnpm lint

echo "Running typecheck..."
pnpm typecheck

echo "Running format check..."
pnpm format:check

echo "Lint complete."
