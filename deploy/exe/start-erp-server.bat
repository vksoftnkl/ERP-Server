@echo off
title ERP Server
cd /d "%~dp0"
if not exist ".env" (
  echo .env is missing. Copy .env.example to .env and fill in the CHANGE_ME values.
  pause
  exit /b 1
)
erp-server.exe
echo.
echo [ERP Server stopped - press any key to close]
pause >nul
