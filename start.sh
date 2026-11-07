#!/usr/bin/env bash
# Start Tango Cards on macOS or Linux. From this folder: ./start.sh
set -e
cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  echo "Tango Cards needs uv, a small Python tool. Install it with:"
  echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
  echo "Then open a new terminal window and run ./start.sh again."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env. Open it, paste your Gemini API key after GEMINI_API_KEY=,"
  echo "save it, then run ./start.sh again."
  exit 1
fi

PORT="${PORT:-8000}"
echo "Starting Tango Cards at http://localhost:$PORT (press Ctrl+C to stop)"
echo "The first start downloads Python packages and can take a minute."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
