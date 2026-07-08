#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Cleaning Agent Preflight Artifacts ==="

echo "Removing build outputs..."
rm -rf \
  packages/*/dist \
  packages/*/build \
  apps/*/dist \
  apps/*/build \
  apps/*/.next

echo "Removing coverage reports..."
rm -rf coverage

echo "Removing turbo cache..."
rm -rf .turbo

echo "Removing node_modules..."
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/node_modules

echo "Clean complete."
