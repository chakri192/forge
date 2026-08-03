@echo off
TITLE Forge Platform Startup
COLOR 0A

echo ===================================================
echo               FORGE PLATFORM v0.50-alpha
echo ===================================================
echo.

cd /d "%~dp0"

IF NOT EXIST "node_modules" (
    echo [1/3] Node modules missing. Installing dependencies...
    call npm install
    echo.
) ELSE (
    echo [1/3] Dependencies verified.
)

IF NOT EXIST "forge.db" (
    echo [2/3] Initializing and seeding SQLite database...
    call node src/server/db/seed.js
    echo.
) ELSE (
    echo [2/3] Database verified.
)

echo [3/3] Launching Forge server and opening web browser...
echo.
echo Server running at http://localhost:3001
echo Press Ctrl+C in this window to stop the server.
echo.

start "" powershell -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3001'"

call npm start
