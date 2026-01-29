#!/usr/bin/env bash
# Скрипт для локальной сборки и деплоя

set -euo pipefail

echo "🔨 Building React application locally..."
npm run build

echo "📦 Checking build directory..."
if [ ! -d "build" ] || [ -z "$(ls -A build 2>/dev/null)" ]; then
    echo "❌ Error: build directory is empty or doesn't exist"
    exit 1
fi

echo "✅ Build completed successfully"
echo "📤 Ready to commit and push. Run:"
echo "   git add build/"
echo "   git commit -m 'Update build'"
echo "   git push"
echo ""
echo "Then on server run: ./deploy.sh"
