#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Building Agent Preflight ==="

NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
export NODE_OPTIONS

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Running TypeScript build..."
pnpm build

echo "Running typecheck..."
pnpm typecheck

echo "Build complete."
