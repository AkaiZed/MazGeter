@echo off
cd /d "%~dp0"
if exist ".\release\win-unpacked\MazGeter.exe" (
  start "" ".\release\win-unpacked\MazGeter.exe"
) else (
  start "" ".\node_modules\electron\dist\electron.exe" .
)
