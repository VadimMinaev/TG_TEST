#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Ensure script is executable
chmod +x "$0"

echo "Updating repo..."
# Stash local changes if any (silently)
git stash > /dev/null 2>&1 || true

# Pull latest changes
if ! git pull --ff-only origin main; then
    echo "⚠️  Pull failed, resetting to remote state..."
    git fetch origin main
    git reset --hard origin/main
fi

echo "Checking for pre-built files..."
if [ ! -d "build" ] || [ -z "$(ls -A build 2>/dev/null)" ]; then
    echo "⚠️  Warning: build/ directory is empty. Docker will need to build it (may be slow on weak servers)."
else
    echo "✅ Found pre-built files in build/ directory"
fi

echo "Cleaning old Docker images and cache..."
docker compose down
docker system prune -f

echo "Rebuilding and restarting containers..."
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build without cache to ensure fresh build
docker compose build --no-cache

# Start containers
docker compose up -d

echo "Showing app logs (last 20 lines)..."
docker compose logs app --tail=20

echo "Done."
