# Обновление проекта (одной командой)

## На сервере
```bash
cd ~/apps/TG_TEST
./deploy.sh
```

## Если скрипта нет
```bash
cd ~/apps/TG_TEST
git pull
chmod +x deploy.sh
./deploy.sh
```

## Что делает `deploy.sh`
```bash
git pull --ff-only origin main
docker compose up -d --build
docker compose logs app --tail=20
```

## Ручная накатка
```bash
cd ~/apps/TG_TEST
git pull
docker compose up -d --build
docker compose logs app --tail=20
```
