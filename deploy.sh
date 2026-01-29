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

# Stop ALL containers first
docker ps -aq | xargs -r docker stop 2>/dev/null || true
docker ps -aq | xargs -r docker rm 2>/dev/null || true

# Remove all iptables rules for port 3000 (Docker creates these)
if command -v iptables >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
    echo "Cleaning iptables rules for port 3000..."
    iptables -t nat -D DOCKER -p tcp --dport 3000 -j DNAT 2>/dev/null || true
    iptables -t filter -D DOCKER -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
fi

# Check what's using port 3000 with multiple methods
echo "Checking what's using port 3000..."

# Method 1: lsof
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(sudo lsof -ti:3000 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            CMD=$(ps -p $PID -o cmd= 2>/dev/null || echo "")
            if echo "$CMD" | grep -qE "(node|docker|tg_test|app\.js)" || [ -z "$CMD" ]; then
                echo "Killing process $PID: $CMD"
                sudo kill -9 $PID 2>/dev/null || true
            fi
        done
    fi
fi

# Method 2: ss (more reliable)
if command -v ss >/dev/null 2>&1; then
    PIDS=$(sudo ss -tlnp 2>/dev/null | grep ":3000 " | grep -oP 'pid=\K[0-9]+' | sort -u || true)
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            CMD=$(ps -p $PID -o cmd= 2>/dev/null || echo "")
            if echo "$CMD" | grep -qE "(node|docker|tg_test|app\.js)" || [ -z "$CMD" ]; then
                echo "Killing process $PID (from ss): $CMD"
                sudo kill -9 $PID 2>/dev/null || true
            fi
        done
    fi
fi

# Method 3: fuser
if command -v fuser >/dev/null 2>&1; then
    sudo fuser -k 3000/tcp 2>/dev/null || true
fi

# Wait for port to be fully freed
echo "Waiting for port 3000 to be freed..."
for i in {1..10}; do
    if ! (sudo lsof -ti:3000 >/dev/null 2>&1 || sudo ss -tln | grep -q ":3000 "); then
        echo "Port 3000 is free!"
        break
    fi
    echo "Port still in use, waiting... ($i/10)"
    sleep 1
done

# Start containers
echo "Starting containers..."
docker compose up -d

echo "Waiting for container to start..."
sleep 3

echo "Checking container status..."
docker ps --filter "name=tg_test-app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "Showing app logs (last 30 lines)..."
docker compose logs app --tail=30

echo ""
echo "✅ Done! Container should be running on port 3000"
echo "Check with: docker ps"
echo "View logs: docker compose logs -f app"
