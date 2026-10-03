@echo off
setlocal
cd /d "%~dp0"
if not exist ".env.local" copy ".env.example" ".env.local" >nul
start "Aami Bakes Supabase setup" notepad.exe ".env.local"
