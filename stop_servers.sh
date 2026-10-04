#!/usr/bin/env bash
# Stop the Phase 1 servers. Slide 22: ./stop_servers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

stop_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$file"
  fi
}

stop_port() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pids
  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.3
    pids="$(lsof -ti tcp:"$port" || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

stop_pid_file "$ROOT/.run/fastapi.pid"
stop_pid_file "$ROOT/.run/express.pid"
stop_port 8000
stop_port 8001
echo "Stopped servers on ports 8000 and 8001."
