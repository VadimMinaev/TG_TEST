Сделай полный деплой‑контур для одного Node.js веб‑проекта без БД, с Caddy и HTTPS.
Все файлы — в корне проекта. Никаких внешних сервисов.
Нужно: docker-compose.yml, .env.example, deploy.sh, .gitignore, README.md, Caddyfile.
Требования:
1) .env.example
DOMAIN=project.example.comHOST_PORT=3001PROJECT_NAME=project
2) docker-compose.yml
два сервиса: app и caddy
app:
build: .
НЕ публиковать наружу порт 3000
environment: NODE_ENV=production, DOMAIN=${DOMAIN}
volumes: ./data:/app/data, ./logs:/app/logs
restart: unless-stopped
healthcheck curl -f http://localhost:3000/health
caddy:
image: caddy:2
ports: 80:80, 443:443
volumes: ./Caddyfile:/etc/caddy/Caddyfile, ./caddy_data:/data, ./caddy_config:/config
environment: DOMAIN=${DOMAIN}
restart: unless-stopped
depends_on: app
3) Caddyfile
{$DOMAIN:localhost} {  encode gzip  reverse_proxy app:3000  header {    X-Content-Type-Options nosniff    X-Frame-Options SAMEORIGIN    Referrer-Policy no-referrer-when-downgrade  }}
4) deploy.sh (строго):
mkdir -p для всех путей
никогда не удалять данные
перед обновлением делать backup конфигов в ./backup/
при ошибке — откат из backup
не останавливать чужие контейнеры, только этот проект
использовать || true для безопасных операций
учитывать docker compose или docker-compose
без БД
не трогать другие проекты и порты, кроме ${HOST_PORT}, 80, 443
если git pull падает — не стопорить деплой
после деплоя проверить http://localhost:${HOST_PORT}/health
при фейле — откат и вывод причины
проект должен стартовать без БД
Caddy слушает 80/443; не убивать чужие процессы, только контейнеры этого проекта
5) .gitignore
.envnode_modules/logs/backup/data/caddy_data/caddy_config/*.log.DS_Store
6) README.md (первый запуск)
cp .env.example .envnano .envchmod +x deploy.sh./deploy.sh
Важно:
никаких вопросов ко мне, действуй автономно
сначала создаёшь файлы, потом даёшь инструкцию запуска
не ломать окружение, никаких глобальных docker compose down без имени проекта
все операции должны быть безопасными


