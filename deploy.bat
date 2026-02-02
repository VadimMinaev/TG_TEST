@echo off
chcp 65001 >nul
echo.
echo === Сборка и деплой ===
echo.

REM Сборка фронтенда локально
echo [1/4] Сборка фронтенда...
call npm run build
if errorlevel 1 (
    echo ОШИБКА: npm run build не удался
    pause
    exit /b 1
)

REM Git операции
echo [2/4] Добавление файлов в git...
git add -A

echo [3/4] Коммит...
git commit -m "Build: %date% %time%"

echo [4/4] Push в репозиторий...
git push origin master:main

echo.
echo === Готово! ===
echo.
echo Теперь на сервере выполни:
echo   cd ~/apps/TG_TEST
echo   git pull origin main
echo   docker compose up -d --force-recreate
echo.
pause
