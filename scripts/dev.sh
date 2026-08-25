#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "Created backend/.env from .env.example"
fi

if [ ! -f "$ROOT/frontend/.env.local" ]; then
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env.local"
  echo "Created frontend/.env.local from .env.example"
fi

cleanup() { jobs -p | xargs -r kill 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(cd "$ROOT/backend" && uv run fastapi dev app/main.py) &
(cd "$ROOT/frontend" && npm run dev) &
wait
