@echo off
echo ============================================
echo   Insurance Tracker - Quick Setup
echo ============================================
echo.

cd /d "%~dp0"

echo [1/5] Stopping old PostgreSQL container...
docker stop insurance-db 2>nul
docker rm insurance-db 2>nul
docker volume rm insurance_pgdata 2>nul

echo [2/5] Starting fresh PostgreSQL container...
docker compose up -d postgres
if errorlevel 1 (
    echo ERROR: Failed to start PostgreSQL. Is Docker Desktop running?
    pause
    exit /b 1
)

echo Waiting for PostgreSQL to be healthy...
:wait_loop
timeout /t 2 /nobreak >nul
docker exec insurance-db pg_isready -U insurance -d insurance_tracker >nul 2>&1
if errorlevel 1 goto wait_loop
echo PostgreSQL is ready!

echo.
echo [3/5] Generating Prisma client...
cd apps\backend
call npx prisma generate
if errorlevel 1 (
    echo ERROR: Prisma generate failed.
    pause
    exit /b 1
)

echo.
echo [4/5] Running database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo ERROR: Migrations failed.
    pause
    exit /b 1
)

echo.
echo [5/5] Seeding database...
call npx tsx prisma/seed.ts
if errorlevel 1 (
    echo WARNING: Seed failed (may already be seeded).
)

echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo   Manager login:  manager@insurance.ma / admin1234
echo   Employee login: employe1@insurance.ma / employee1234
echo.
echo   Starting backend server...
echo.
call npx tsx src/index.ts
