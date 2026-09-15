@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Horror Tree - Live Server

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js wurde nicht gefunden.
  echo Installiere Node.js von https://nodejs.org/ und starte diese Datei erneut.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0server.js" (
  echo.
  echo server.js wurde nicht gefunden.
  echo Starte die BAT-Datei direkt im Horror-Tree-Ordner.
  echo.
  pause
  exit /b 1
)

echo Horror Tree wird gestartet...
echo Der Live-Server oeffnet den Browser automatisch.
echo Dieses Fenster offen lassen, solange du spielen willst.
echo.

node "%~dp0server.js"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Der Live-Server wurde mit Fehlercode %EXIT_CODE% beendet.
  pause
)

exit /b %EXIT_CODE%
