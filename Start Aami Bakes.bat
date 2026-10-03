@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
if not exist ".env.local" (
  echo Please create .env.local first by copying .env.example and adding your Supabase publishable key.
  pause
  exit /b 1
)
call npm.cmd run dev
pause
