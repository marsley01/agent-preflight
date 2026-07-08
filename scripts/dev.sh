#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Agent Preflight Development Environment ==="

cleanup() {
  echo ""
  echo "Shutting down development environment..."
  docker compose -f infra/docker/docker-compose.yml down
  exit 0
}
trap cleanup SIGINT SIGTERM

if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  corepack enable
  corepack prepare pnpm@latest --activate
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Starting infrastructure services..."
docker compose -f infra/docker/docker-compose.yml up -d redis postgres

echo "Waiting for dependencies to be healthy..."
sleep 5

echo "Starting development servers..."
pnpm dev
