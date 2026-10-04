#!/usr/bin/env bash
# Start FastAPI on port 8000 and Express on port 8001.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/.run"

if lsof -ti tcp:8000 >/dev/null 2>&1 || lsof -ti tcp:8001 >/dev/null 2>&1; then
  echo "Port 8000 or 8001 is already in use. Run ./stop_servers.sh first."
  exit 1
fi

if [[ -x "$ROOT/server/fastapi/.venv/bin/uvicorn" ]]; then
  UVICORN="$ROOT/server/fastapi/.venv/bin/uvicorn"
elif command -v uvicorn >/dev/null 2>&1; then
  UVICORN="$(command -v uvicorn)"
else
  echo "uvicorn is not installed."
  echo "From server/fastapi: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [[ ! -d "$ROOT/server/express/node_modules/express" ]]; then
  echo "Express dependencies are not installed."
  echo "From server/express: npm install"
  exit 1
fi

cd "$ROOT/server/fastapi"
nohup "$UVICORN" main:app --reload --host 127.0.0.1 --port 8000 >"$ROOT/.run/fastapi.log" 2>&1 &
echo $! >"$ROOT/.run/fastapi.pid"

cd "$ROOT/server/express"
nohup node index.js >"$ROOT/.run/express.log" 2>&1 &
echo $! >"$ROOT/.run/express.pid"

wait_for() {
  local url="$1"
  local i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if curl -sf "$url" >/dev/null; then
      return 0
    fi
    sleep 0.25
  done
  echo "Timed out waiting for $url"
  echo "FastAPI log: $ROOT/.run/fastapi.log"
  echo "Express log: $ROOT/.run/express.log"
  exit 1
}

wait_for "http://127.0.0.1:8000/v1/books/1"
wait_for "http://127.0.0.1:8001/v1/books/1"

echo "FastAPI  http://127.0.0.1:8000/docs"
echo "Express  http://127.0.0.1:8001/docs"
echo "Stop both with ./stop_servers.sh"
