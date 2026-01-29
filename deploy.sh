#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Updating repo..."
git pull --ff-only origin main

echo "Rebuilding and restarting containers..."
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Limit build resources to prevent server overload
export BUILDKIT_STEP_LOG_MAX_SIZE=5000000
export BUILDKIT_STEP_LOG_MAX_SPEED=10000000

# Build with resource limits
docker compose build --memory=800m --cpuset-cpus="0"

# Start containers
docker compose up -d

echo "Showing app logs (last 20 lines)..."
docker compose logs app --tail=20

echo "Done."
