@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "SEMPAUSA=0"
if /I "%~1"=="nopause" set "SEMPAUSA=1"

echo ============================================================
echo   LEADHUNTER AI - EXE local sem Docker
echo ============================================================
echo.

where py >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Python Launcher nao encontrado no PATH.
  goto erro
)
where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  goto erro
)
where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] pnpm nao encontrado no PATH.
  goto erro
)

if not exist ".venv-launcher-313\Scripts\python.exe" (
  echo Criando ambiente de empacotamento Python 3.13...
  py -3.13 -m venv .venv-launcher-313
  if errorlevel 1 goto erro
)

set "PY=.venv-launcher-313\Scripts\python.exe"
echo [1/3] Instalando o empacotador e a janela nativa...
"%PY%" -m pip install --quiet --upgrade pip
if errorlevel 1 goto erro
"%PY%" -m pip install --quiet -r requirements-desktop.txt
if errorlevel 1 goto erro

echo [2/3] Montando API, interface, banco SQLite e Node portatil...
"%PY%" desktop\build_runtime.py
if errorlevel 1 goto erro

echo [3/3] Gerando LeadHunterAI.exe sem console...
"%PY%" -m PyInstaller desktop\launcher.py ^
  --name LeadHunterAI ^
  --onefile ^
  --windowed ^
  --icon "assets\leadhunter-icon.ico" ^
  --clean ^
  --noconfirm ^
  --collect-all webview ^
  --add-data "desktop\runtime-package.zip;." ^
  --add-data "assets\leadhunter-icon.ico;assets" ^
  --version-file desktop\version_info.txt
if errorlevel 1 goto erro

if not exist "dist\LeadHunterAI.exe" goto erro
echo.
echo [OK] Executavel criado e sem dependencia do Docker:
echo      %CD%\dist\LeadHunterAI.exe
goto fim

:erro
echo.
echo [ERRO] O executavel nao foi gerado. Veja a mensagem acima.
if "%SEMPAUSA%"=="0" pause
endlocal & exit /b 1

:fim
if "%SEMPAUSA%"=="0" pause
endlocal & exit /b 0
