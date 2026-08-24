@echo off
setlocal enabledelayedexpansion

rem Builds the LeadHunter AI Windows installer:
rem   1. install deps + build backend, web, desktop
rem   2. flatten backend/web into apps\desktop\resources with real
rem      (non-symlinked) node_modules via `pnpm deploy` - pnpm's normal
rem      symlinked node_modules doesn't survive being copied into an
rem      installer, this is the pnpm-specific equivalent of the datas=[...]
rem      gotcha PyInstaller builds hit
rem   3. run electron-builder against apps\desktop
rem
rem Run this from the repo root: build_windows.bat

cd /d "%~dp0"

echo === [1/8] Installing dependencies ===
call pnpm install
if errorlevel 1 goto :error

echo === [2/8] Generating Prisma Client (nest build type-checks against it) ===
rem generate doesn't need a real, reachable database - it only needs
rem DATABASE_URL to be *set* so schema.prisma's env("DATABASE_URL") resolves.
set DATABASE_URL=file:./dev.db
call pnpm --filter @leadhunter/backend exec prisma generate
if errorlevel 1 goto :error

echo === [3/8] Building backend ===
call pnpm --filter @leadhunter/backend build
if errorlevel 1 goto :error

echo === [4/8] Building web (relative /api base URL for the desktop shell) ===
set NEXT_PUBLIC_API_URL=/api
call pnpm --filter @leadhunter/web build
if errorlevel 1 goto :error

echo === [5/8] Building desktop wrapper ===
call pnpm --filter @leadhunter/desktop build
if errorlevel 1 goto :error

echo === [6/8] Staging backend (flattened node_modules + generated Prisma client) ===
rem --legacy: pnpm 10+ defaults to "injected" workspace deploys, which
rem needs inject-workspace-packages=true set project-wide. --legacy keeps
rem the plain copy-and-flatten behavior this script actually wants.
if exist "apps\desktop\resources\backend" rmdir /s /q "apps\desktop\resources\backend"
call pnpm --filter @leadhunter/backend deploy "apps\desktop\resources\backend" --prod --legacy
if errorlevel 1 goto :error
pushd "apps\desktop\resources\backend"
set DATABASE_URL=file:./dev.db
call node node_modules\prisma\build\index.js generate
if errorlevel 1 (popd & goto :error)
popd

echo === [7/8] Staging web (flattened node_modules) ===
if exist "apps\desktop\resources\web" rmdir /s /q "apps\desktop\resources\web"
call pnpm --filter @leadhunter/web deploy "apps\desktop\resources\web" --prod --legacy
if errorlevel 1 goto :error

echo === [8/8] Packaging the Windows installer ===
pushd apps\desktop
call npx electron-builder --win
if errorlevel 1 (popd & goto :error)
popd

echo.
echo Build complete. Installer is in apps\desktop\release\
pause
exit /b 0

:error
echo.
echo Build FAILED - see the error above.
pause
exit /b 1
