#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Updating repo..."
git pull --ff-only origin main

echo "Rebuilding and restarting containers..."
docker compose up -d --build

echo "Showing app logs (last 20 lines)..."
docker compose logs app --tail=20

echo "Done."
