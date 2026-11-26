@echo off
cd /d "%~dp0"

:: Auto-close any running MazGeter / electron / aria2c instance before launching fresh
taskkill /F /IM MazGeter.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM aria2c.exe >nul 2>&1
timeout /t 1 /nobreak >nul

if exist ".\release\win-unpacked\MazGeter.exe" (
  start "" ".\release\win-unpacked\MazGeter.exe"
) else (
  start "" ".\node_modules\electron\dist\electron.exe" .
)
