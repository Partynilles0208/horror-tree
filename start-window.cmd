@echo off
setlocal
cd /d "%~dp0"
set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "ELECTRON_RUN_AS_NODE="

if exist "%~dp0electron\electron.exe" (
  start "" "%~dp0electron\electron.exe" "%APP_DIR%"
  exit /b 0
)

if exist "%~dp0node_modules\.bin\electron.cmd" (
  call "%~dp0node_modules\.bin\electron.cmd" "%APP_DIR%"
  exit /b %ERRORLEVEL%
)

echo Electron wurde nicht gefunden.
echo Starte stattdessen im Browser.
call "%~dp0start-game.cmd"
