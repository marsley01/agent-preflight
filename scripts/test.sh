#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Running Agent Preflight Tests ==="

NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
export NODE_OPTIONS

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Building packages..."
pnpm build

echo "Running tests..."
pnpm test "$@"

echo "Tests complete."
