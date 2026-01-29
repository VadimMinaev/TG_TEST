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

echo "Stopping and removing old containers..."
docker compose down || true

# Free port 3000 if it's in use
if [ -f "./free-port.sh" ]; then
    chmod +x ./free-port.sh
    ./free-port.sh || true
fi

echo "Cleaning old Docker images and cache..."
docker system prune -f

echo "Rebuilding and restarting containers..."
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build without cache to ensure fresh build
docker compose build --no-cache

# Stop any containers using port 3000
echo "Freeing port 3000..."
# Stop all containers that might use port 3000
docker ps -q --filter "publish=3000" | xargs -r docker stop 2>/dev/null || true
docker ps -a -q --filter "publish=3000" | xargs -r docker rm -f 2>/dev/null || true

# Also check for processes directly using port 3000 (not in Docker)
if command -v lsof >/dev/null 2>&1; then
    lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true
elif command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp 2>/dev/null || true
fi

# Wait a moment for port to be freed
sleep 2

# Start containers
docker compose up -d

echo "Showing app logs (last 20 lines)..."
docker compose logs app --tail=20

echo "Done."
