# Деплой проекта

## Первый запуск
```bash
cp .env.example .env
nano .env  # Укажи:
           # DOMAIN=sub.example.com
           # HOST_PORT=3001 (опционально, не используется при доступе через домен)
           # PROJECT_NAME=my-project
           # POSTGRES_DB=my_db
           # POSTGRES_USER=my_user
           # POSTGRES_PASSWORD=my_pass
           # DATABASE_URL=postgresql://my_user:my_pass@db:5432/my_db
chmod +x deploy.sh
./deploy.sh
```

## PostgreSQL
PostgreSQL поднимается внутри `docker-compose.yml` (сервис `db`). Приложение
использует его автоматически, если указан `DATABASE_URL` в `.env`.

## Доступ без порта
Домен обслуживает `caddy` (80/443) и проксирует трафик в приложение на `app:3000`.
Убедитесь, что DNS домена указывает на этот сервер и открыты порты 80/443.
