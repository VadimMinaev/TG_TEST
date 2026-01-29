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
# Use production compose file if it exists, otherwise use default
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo "Using docker-compose.prod.yml (with Caddy)"
fi
docker compose -f $COMPOSE_FILE down || true

echo "Cleaning old Docker images and cache..."
docker system prune -f

echo "Rebuilding and restarting containers..."
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build without cache to ensure fresh build
docker compose -f $COMPOSE_FILE build --no-cache

# Function to free a port
free_port() {
    local PORT=$1
    local SAFE_PATTERNS=$2  # Patterns that are safe to kill (e.g., "caddy|docker|tg_test")
    
    echo "Freeing port $PORT..."
    
    # Remove iptables rules for this port
    if command -v iptables >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
        iptables -t nat -D DOCKER -p tcp --dport $PORT -j DNAT 2>/dev/null || true
        iptables -t filter -D DOCKER -p tcp --dport $PORT -j ACCEPT 2>/dev/null || true
    fi
    
    # Method 1: lsof
    if command -v lsof >/dev/null 2>&1; then
        PIDS=$(sudo lsof -ti:$PORT 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            for PID in $PIDS; do
                CMD=$(ps -p $PID -o cmd= 2>/dev/null || echo "")
                if echo "$CMD" | grep -qE "$SAFE_PATTERNS" || [ -z "$CMD" ]; then
                    echo "  Killing process $PID: $CMD"
                    sudo kill -9 $PID 2>/dev/null || true
                else
                    echo "  ⚠️  WARNING: Port $PORT is used by another app: PID $PID - $CMD"
                    echo "  ⚠️  Not killing it. Please stop it manually if needed."
                fi
            done
        fi
    fi
    
    # Method 2: ss (more reliable)
    if command -v ss >/dev/null 2>&1; then
        PIDS=$(sudo ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u || true)
        if [ -n "$PIDS" ]; then
            for PID in $PIDS; do
                CMD=$(ps -p $PID -o cmd= 2>/dev/null || echo "")
                if echo "$CMD" | grep -qE "$SAFE_PATTERNS" || [ -z "$CMD" ]; then
                    echo "  Killing process $PID (from ss): $CMD"
                    sudo kill -9 $PID 2>/dev/null || true
                else
                    echo "  ⚠️  WARNING: Port $PORT is used by another app: PID $PID - $CMD"
                    echo "  ⚠️  Not killing it. Please stop it manually if needed."
                fi
            done
        fi
    fi
    
    # Method 3: fuser (only if safe patterns match)
    if command -v fuser >/dev/null 2>&1; then
        # Check if any process matches safe patterns before killing
        PIDS=$(sudo fuser $PORT/tcp 2>/dev/null | grep -oP '\d+' || true)
        if [ -n "$PIDS" ]; then
            for PID in $PIDS; do
                CMD=$(ps -p $PID -o cmd= 2>/dev/null || echo "")
                if echo "$CMD" | grep -qE "$SAFE_PATTERNS" || [ -z "$CMD" ]; then
                    sudo fuser -k $PORT/tcp 2>/dev/null || true
                    break
                fi
            done
        fi
    fi
    
    # Wait for port to be fully freed
    for i in {1..10}; do
        if ! (sudo lsof -ti:$PORT >/dev/null 2>&1 || sudo ss -tln | grep -q ":$PORT "); then
            echo "  ✅ Port $PORT is free!"
            return 0
        fi
        echo "  Port $PORT still in use, waiting... ($i/10)"
        sleep 1
    done
    
    echo "  ⚠️  Port $PORT may still be in use"
    return 1
}

# Stop ALL containers first
echo "Stopping all containers..."
docker ps -aq | xargs -r docker stop 2>/dev/null || true
docker ps -aq | xargs -r docker rm 2>/dev/null || true

# Free ports before starting containers
echo "Freeing ports before starting containers..."

# If using production compose (with Caddy), only free ports 80 and 443
# Port 3000 is not exposed to host, so no need to free it
if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    free_port 80 "(caddy|docker|nginx|apache|tg_test)"
    free_port 443 "(caddy|docker|nginx|apache|tg_test)"
else
    # For regular compose, free port 3000 (it's exposed to host)
    free_port 3000 "(node|docker|tg_test|app\.js)"
fi

# Start containers
echo "Starting containers..."
docker compose -f $COMPOSE_FILE up -d

echo "Waiting for container to start..."
sleep 3

echo "Checking container status..."
docker ps --filter "name=tg_test-app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "Showing app logs (last 30 lines)..."
docker compose -f $COMPOSE_FILE logs app --tail=30

echo "Showing Caddy logs (if running)..."
docker compose -f $COMPOSE_FILE logs caddy --tail=10 2>/dev/null || true

echo ""
echo "✅ Done! Container should be running on port 3000"
echo "Check with: docker ps"
echo "View logs: docker compose logs -f app"
