@echo off
rem Start Tango Cards on Windows. Double-click this file, or run start.bat from this folder.
cd /d "%~dp0"

where uv >nul 2>nul
if errorlevel 1 (
  echo Tango Cards needs uv, a small Python tool. Install it by running this in PowerShell:
  echo   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  echo Then open a new window and run start.bat again.
  pause
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo Created .env. Open it in Notepad, paste your Gemini API key after GEMINI_API_KEY=,
  echo save it, then run start.bat again.
  pause
  exit /b 1
)

if "%PORT%"=="" set PORT=8000
echo Starting Tango Cards at http://localhost:%PORT% (close this window to stop)
echo The first start downloads Python packages and can take a minute.
uv run uvicorn app.main:app --host 0.0.0.0 --port %PORT%
pause
