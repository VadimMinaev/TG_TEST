Локально (Windows / PowerShell)
1) Перейти в проект
cd C:\Code\TG_TEST
2) Подтянуть зависимости (если нужно после обновлений)
npm install
3) Собрать фронт
npm run build
4) Проверить, что изменилось
git status
5) Добавить изменения (код + build)
git add server/app.js src/ build/
(или проще всё)
git add -A
6) Закоммитить
git commit -m "your message"
7) Отправить в GitHub
git push
На сервере (Linux)
1) Перейти в папку проекта (важно: не в ~, а в каталог где есть .git)
cd ~/apps/TG_TEST

cd ~/apps/TG_TEST && git fetch origin && git reset --hard origin/master && docker compose build --no-cache app && docker compose up -d --force-recreate --no-deps app
2) Забрать изменения и обновить рабочую копию
git fetch origin && git reset --hard origin/master
3) Пересобрать контейнер и перезапустить только app
docker compose build --no-cache app && docker compose up -d --force-recreate --no-deps app
Если на сервере ругается “not a git repository”
Значит вы не в папке проекта. Сначала найдите/перейдите в правильную директорию (где лежит .git и docker-compose.yml), обычно:
4) Проверить логи 
docker compose logs -f app
