@echo off
setlocal enabledelayedexpansion

rem One-click updater: double-click this whenever you want the latest
rem version. Kills the running app, pulls the latest source (git if this
rem is a clone, otherwise downloads the branch as a zip - most people who
rem "download the code" get a zip, not a git clone), rebuilds, then
rem silently re-runs the installer so the Desktop/Start Menu shortcuts keep
rem pointing at the new build. User data (accounts, searches, database)
rem lives under %LOCALAPPDATA%\LeadHunter AI\data, completely outside this
rem project folder, so none of this can touch it.

set REPO_OWNER=anderson17quadri-cmd
set REPO_NAME=cacador-de-clientes
set DEFAULT_BRANCH=main

cd /d "%~dp0"

echo === Fechando o LeadHunter AI, se estiver aberto ===
taskkill /IM "LeadHunter AI.exe" /F >nul 2>&1

if exist ".git" (
  echo === Repositorio git detectado - a atualizar via git ===
  for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
  call git fetch origin "%BRANCH%"
  if errorlevel 1 goto :error
  call git reset --hard "origin/%BRANCH%"
  if errorlevel 1 goto :error
) else (
  echo === Sem repositorio git - a transferir o codigo mais recente ===
  set ZIP_URL=https://github.com/%REPO_OWNER%/%REPO_NAME%/archive/refs/heads/%DEFAULT_BRANCH%.zip
  set TMP_ZIP=%TEMP%\leadhunter-update.zip
  set TMP_EXTRACT=%TEMP%\leadhunter-update-extract

  if exist "%TMP_EXTRACT%" rmdir /s /q "%TMP_EXTRACT%"
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%TMP_ZIP%'"
  if errorlevel 1 goto :error
  powershell -NoProfile -Command "Expand-Archive -Path '%TMP_ZIP%' -DestinationPath '%TMP_EXTRACT%' -Force"
  if errorlevel 1 goto :error

  rem Expand-Archive produces a single "<repo>-<branch>" subfolder - copy its
  rem contents over this install, excluding build output, deps, and this
  rem project's own local .env (which the fresh zip doesn't have anyway).
  for /d %%d in ("%TMP_EXTRACT%\*") do set EXTRACTED_DIR=%%d
  robocopy "!EXTRACTED_DIR!" "%~dp0" /E /XD node_modules dist .next resources release .git ^
    /XF .env
  if errorlevel 8 goto :error

  rmdir /s /q "%TMP_EXTRACT%" >nul 2>&1
  del "%TMP_ZIP%" >nul 2>&1
)

echo === A reconstruir a aplicacao ===
call build_windows.bat
if errorlevel 1 goto :error

echo === A reinstalar silenciosamente (mantem os teus dados) ===
set INSTALLER=
for %%f in ("apps\desktop\release\LeadHunterAI-Setup-*.exe") do set INSTALLER=%%f
if "%INSTALLER%"=="" (
  echo Nao encontrei o instalador gerado em apps\desktop\release\
  goto :error
)
"%INSTALLER%" /S
if errorlevel 1 goto :error

echo.
echo Atualizacao concluida!
pause
exit /b 0

:error
echo.
echo A atualizacao FALHOU. Nada foi apagado - podes tentar novamente.
pause
exit /b 1
