@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "SEMPAUSA=0"
if /I "%~1"=="nopause" set "SEMPAUSA=1"
set "RESULTADO=0"

echo ============================================================
echo   LEADHUNTER AI - atualizar EXE local sem Docker
echo ============================================================
echo.

taskkill /IM LeadHunterAI.exe /F >nul 2>&1

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] pnpm nao encontrado. Instale Node.js e pnpm.
  goto erro
)

echo [1/4] Instalando dependencias do projeto...
call pnpm install --frozen-lockfile
if errorlevel 1 goto erro

echo [2/4] Testando a API local...
call pnpm --filter @leadhunter/backend exec jest --runInBand
if errorlevel 1 goto erro

echo [3/4] Reconstruindo o executavel autocontido...
call build_windows.bat nopause
if errorlevel 1 goto erro

echo [4/4] Instalando e verificando o arquivo...
set "INSTALADO=%LOCALAPPDATA%\Programs\LeadHunterAI"
if not exist "!INSTALADO!" mkdir "!INSTALADO!"
copy /Y "dist\LeadHunterAI.exe" "!INSTALADO!\LeadHunterAI.exe" >nul
if errorlevel 1 goto erro
copy /Y "assets\leadhunter-icon.ico" "!INSTALADO!\LeadHunterAI.ico" >nul
if errorlevel 1 goto erro

powershell -NoProfile -Command ^
  "$dir=Join-Path $env:LOCALAPPDATA 'Programs\LeadHunterAI'; $exe=Join-Path $dir 'LeadHunterAI.exe'; $ico=Join-Path $dir 'LeadHunterAI.ico'; $a=(Get-FileHash -Algorithm SHA256 -LiteralPath 'dist\LeadHunterAI.exe').Hash; $b=(Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash; if($a -ne $b){exit 1}; $desktop=[Environment]::GetFolderPath('Desktop'); $link=Join-Path $desktop 'LeadHunter AI.lnk'; $shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut($link); $shortcut.TargetPath=$exe; $shortcut.WorkingDirectory=$dir; $shortcut.IconLocation=$ico+',0'; $shortcut.Description='LeadHunter AI - Cacador de Clientes'; $shortcut.Save()"
if errorlevel 1 goto erro

echo.
echo [OK] LeadHunter AI atualizado e verificado, sem Docker.
echo      !INSTALADO!\LeadHunterAI.exe
if "%SEMPAUSA%"=="0" (
  choice /C SN /M "Abrir o aplicativo agora"
  if errorlevel 2 goto fim
  start "" "!INSTALADO!\LeadHunterAI.exe"
)
goto fim

:erro
set "RESULTADO=1"
echo.
echo [ERRO] A atualizacao nao foi concluida. Os dados locais foram preservados.

:fim
echo.
if "%SEMPAUSA%"=="0" pause
endlocal & exit /b %RESULTADO%
