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

echo === [1/7] Installing dependencies ===
call pnpm install
if errorlevel 1 goto :error

echo === [2/7] Building backend ===
call pnpm --filter @leadhunter/backend build
if errorlevel 1 goto :error

echo === [3/7] Building web (relative /api base URL for the desktop shell) ===
set NEXT_PUBLIC_API_URL=/api
call pnpm --filter @leadhunter/web build
if errorlevel 1 goto :error

echo === [4/7] Building desktop wrapper ===
call pnpm --filter @leadhunter/desktop build
if errorlevel 1 goto :error

echo === [5/7] Staging backend (flattened node_modules + generated Prisma client) ===
if exist "apps\desktop\resources\backend" rmdir /s /q "apps\desktop\resources\backend"
call pnpm --filter @leadhunter/backend deploy "apps\desktop\resources\backend" --prod
if errorlevel 1 goto :error
pushd "apps\desktop\resources\backend"
call node node_modules\prisma\build\index.js generate
if errorlevel 1 (popd & goto :error)
popd

echo === [6/7] Staging web (flattened node_modules) ===
if exist "apps\desktop\resources\web" rmdir /s /q "apps\desktop\resources\web"
call pnpm --filter @leadhunter/web deploy "apps\desktop\resources\web" --prod
if errorlevel 1 goto :error

echo === [7/7] Packaging the Windows installer ===
pushd apps\desktop
call npx electron-builder --win
if errorlevel 1 (popd & goto :error)
popd

echo.
echo Build complete. Installer is in apps\desktop\release\
exit /b 0

:error
echo.
echo Build FAILED.
exit /b 1
