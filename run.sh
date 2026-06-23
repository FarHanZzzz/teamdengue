#!/usr/bin/env bash
# PrevDengue — start backend (API) + frontend (web) together (macOS / Linux)
# Backend: http://127.0.0.1:8000  ·  Frontend: http://localhost:5173
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "Dependencies not installed. Run ./setup.sh first." >&2
  exit 1
fi

echo "Starting backend API on http://127.0.0.1:8000 ..."
(
  cd "$ROOT/backend"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

# Stop the backend when this script exits.
trap 'echo; echo "Stopping backend..."; kill "$BACKEND_PID" 2>/dev/null || true' EXIT

sleep 3
echo "Starting frontend on http://localhost:5173 ... (Ctrl+C to stop both)"
cd "$ROOT/frontend"
npm run dev
