#!/usr/bin/env bash
# Скрипт для безопасного освобождения порта 3000
# Проверяет, что это наше приложение, перед убийством процесса

PORT=3000

echo "Checking what's using port $PORT..."

# Stop all Docker containers using port 3000 first
echo "Stopping Docker containers using port $PORT..."
docker ps -q --filter "publish=$PORT" | xargs -r docker stop 2>/dev/null || true
docker ps -a -q --filter "publish=$PORT" | xargs -r docker rm -f 2>/dev/null || true

# Check with lsof and be careful
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(sudo lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            # Get process info
            CMD=$(ps -p $PID -o cmd= 2>/dev/null || echo "")
            EXE=$(readlink -f /proc/$PID/exe 2>/dev/null || echo "")
            
            # Only kill if it's clearly our app (node, docker, or tg_test related)
            if echo "$CMD" | grep -qE "(node.*app\.js|docker|tg_test|server/app)" || \
               echo "$EXE" | grep -qE "(node|docker)" || \
               [ -z "$CMD" ]; then
                echo "Killing process $PID (our app): $CMD"
                sudo kill -9 $PID 2>/dev/null || true
            else
                echo "⚠️  WARNING: Port $PORT is used by: PID $PID"
                echo "   Command: $CMD"
                echo "   Executable: $EXE"
                echo "   NOT killing - might be another application!"
            fi
        done
    else
        echo "No processes found with lsof"
    fi
fi

sleep 2
echo "Port $PORT check complete"
