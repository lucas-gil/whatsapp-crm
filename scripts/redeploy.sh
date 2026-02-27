#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Detect docker compose command
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  COMPOSE_CMD="docker compose"
fi

echo "Using: $COMPOSE_CMD"

# Recreate redis and backend (build if necessary)
echo "Bringing up redis and backend..."
$COMPOSE_CMD up -d --build redis backend

echo "Waiting a few seconds for services to start..."
sleep 5

echo "Tailing backend logs (last 200 lines):"
$COMPOSE_CMD logs --tail=200 backend
