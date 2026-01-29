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

echo "Cleaning old Docker images and cache..."
docker system prune -f

echo "Rebuilding and restarting containers..."
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build without cache to ensure fresh build
docker compose build --no-cache

# Free port 3000 RIGHT BEFORE starting containers
echo "Freeing port 3000 before starting containers..."
# Stop all Docker containers using port 3000
docker ps -q --filter "publish=3000" | xargs -r docker stop 2>/dev/null || true
docker ps -a -q --filter "publish=3000" | xargs -r docker rm -f 2>/dev/null || true

# Check what's using port 3000 and only kill if it's our app
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(sudo lsof -ti:3000 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            # Check if it's a node process or docker process
            CMD=$(ps -p $PID -o cmd= 2>/dev/null || echo "")
            if echo "$CMD" | grep -qE "(node|docker|tg_test)" || [ -z "$CMD" ]; then
                echo "Killing process $PID (likely our app): $CMD"
                sudo kill -9 $PID 2>/dev/null || true
            else
                echo "⚠️  WARNING: Port 3000 is used by another app: PID $PID - $CMD"
                echo "⚠️  Not killing it. Please stop it manually if needed."
            fi
        done
    fi
fi

# Wait a moment for port to be freed
sleep 3

# Start containers
docker compose up -d

echo "Showing app logs (last 20 lines)..."
docker compose logs app --tail=20

echo "Done."
