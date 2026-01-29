# Деплой проекта

## Первый запуск
```bash
cp .env.example .env
nano .env  # Укажи:
           # DOMAIN=sub.example.com
           # HOST_PORT=3001 (уникальный для каждого проекта!)
           # PROJECT_NAME=my-project
chmod +x deploy.sh
./deploy.sh
```
