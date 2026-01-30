#!/bin/bash
set -e
export PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Ensure script is executable
chmod +x "$0" 2>/dev/null || true

# Безопасное создание папок
mkdir -p ./data ./logs ./backup ./tmp 2>/dev/null || true

# Бэкап перед обновлением
BACKUP_DIR="./backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r ./data "$BACKUP_DIR/" 2>/dev/null || true
cp .env "$BACKUP_DIR/" 2>/dev/null || true
echo "💾 Бэкап сохранён: $BACKUP_DIR"

# Обновление кода (с обработкой локальных изменений)
echo "📥 Загрузка обновлений..."
git stash > /dev/null 2>&1 || true
if ! git pull --ff-only origin main 2>&1; then
    echo "⚠️  Pull failed, resetting to remote state..."
    git fetch origin main
    git reset --hard origin/main
fi

# Загрузка конфига (после обновления скрипта)
[ -f .env ] || { echo "❌ .env не найден. Скопируй .env.example → .env"; exit 1; }
# Безопасная загрузка переменных из .env (игнорируем комментарии и пустые строки)
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)

echo "🚀 Деплой $PROJECT_NAME → $DOMAIN (порт $HOST_PORT)"

# Сборка и запуск (только этот проект)
echo "📦 Сборка контейнера..."
docker-compose build --pull --no-cache 2>&1

echo "🔄 Перезапуск сервиса..."
docker-compose down 2>&1 || true
docker-compose up -d 2>&1

# Проверка здоровья
sleep 10
if curl -s --max-time 10 --fail "http://localhost:${HOST_PORT}/health" > /dev/null 2>&1; then
  echo -e "✅ Успех: $PROJECT_NAME работает на порту $HOST_PORT"
  echo -e "   Доступ: https://$DOMAIN"
  # Очистка старых бэкапов (оставить последние 5)
  ls -td ./backup/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf
else
  echo "❌ Сервис не отвечает. Откат из бэкапа..."
  docker-compose down 2>&1 || true
  cp -r "$BACKUP_DIR/data" ./ 2>/dev/null || true
  docker-compose up -d 2>&1
  sleep 5
  curl -s "http://localhost:${HOST_PORT}/" && echo "⚠️  Частичное восстановление" || echo "❌ Полный откат не удался"
  exit 1
fi
