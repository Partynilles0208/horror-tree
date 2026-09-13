@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden.
  echo Bitte Node.js installieren und dieses Spiel danach erneut starten.
  pause
  exit /b 1
)

node "%~dp0server.js"
