#!/usr/bin/env bash
# Скрипт для освобождения порта 3000

PORT=3000

echo "Checking what's using port $PORT..."

# Check with lsof
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(sudo lsof -ti:$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Found processes using port $PORT: $PIDS"
        echo "$PIDS" | xargs -r sudo kill -9
        echo "Killed processes"
    else
        echo "No processes found with lsof"
    fi
fi

# Check with netstat
if command -v netstat >/dev/null 2>&1; then
    PIDS=$(sudo netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | grep -v "^$" | sort -u)
    if [ -n "$PIDS" ]; then
        echo "Found processes using port $PORT: $PIDS"
        echo "$PIDS" | xargs -r sudo kill -9
        echo "Killed processes"
    fi
fi

# Check with ss (modern alternative to netstat)
if command -v ss >/dev/null 2>&1; then
    PIDS=$(sudo ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
    if [ -n "$PIDS" ]; then
        echo "Found processes using port $PORT: $PIDS"
        echo "$PIDS" | xargs -r sudo kill -9
        echo "Killed processes"
    fi
fi

# Stop all Docker containers using port 3000
echo "Stopping Docker containers using port $PORT..."
docker ps -q --filter "publish=$PORT" | xargs -r docker stop 2>/dev/null || true
docker ps -a -q --filter "publish=$PORT" | xargs -r docker rm -f 2>/dev/null || true

# Kill any node processes that might be running the old server
echo "Stopping any node processes..."
sudo pkill -f "node.*app.js" 2>/dev/null || true

sleep 2
echo "Port $PORT should be free now"
