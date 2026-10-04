#!/usr/bin/env bash
# Narrated Phase 1 demo. Defaults to FastAPI.
#   ./demos/live-demo.sh
#   ./demos/live-demo.sh http://127.0.0.1:8001
set -euo pipefail

BASE="${1:-http://127.0.0.1:8000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$ROOT/.run/demo"
mkdir -p "$TMP"

if ! curl -sf "$BASE/v1/books/1" >/dev/null; then
  echo "Nothing is answering at $BASE"
  echo "Start both servers with ./start_servers.sh"
  exit 1
fi

echo "Library API demo against $BASE"
echo "On a fresh server, the created book is id 51. Restart to get that id again."

show() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local hdr="$TMP/headers"
  local body="$TMP/body"
  echo
  if [[ -n "$data" ]]; then
    echo "\$ curl -i -X $method -H 'Content-Type: application/json' -d '$data' $BASE$path"
    curl -sS -D "$hdr" -o "$body" -X "$method" \
      -H 'Content-Type: application/json' \
      -d "$data" \
      "$BASE$path"
  else
    echo "\$ curl -i -X $method $BASE$path"
    curl -sS -D "$hdr" -o "$body" -X "$method" "$BASE$path"
  fi
  echo
  cat "$hdr"
  if [[ -s "$body" ]]; then
    python3 -m json.tool "$body" 2>/dev/null || cat "$body"
  fi
}

show GET /v1/books/1
show GET '/v1/books?limit=5&offset=10'
show GET '/v1/books?page=3&per_page=10'

show POST /v1/books '{"title":"Dune","author":"Frank Herbert","year":1965}'
BOOK_ID="$(python3 -c 'import json; print(json.load(open("'"$TMP"'/body"))["id"])')"
echo
echo "Created id $BOOK_ID. Location should be /v1/books/$BOOK_ID"

show PATCH "/v1/books/$BOOK_ID" '{"year":1966}'
show PUT "/v1/books/$BOOK_ID" '{"title":"Dune","author":"Frank Herbert","year":1965}'
show POST /v1/books '{"title":"","author":"Frank Herbert","year":1}'
show POST /v1/books '{'
show GET /v1/books/9999
show DELETE "/v1/books/$BOOK_ID"
show DELETE "/v1/books/$BOOK_ID"

show GET '/v1/feed/books?limit=5'
CURSOR="$(python3 -c 'import json; print(json.load(open("'"$TMP"'/body"))["next_cursor"])')"
echo
echo "next_cursor is $CURSOR"
echo "On a fresh server the first page ends at id 5, so this is eyJhZnRlciI6IDV9"
show GET "/v1/feed/books?limit=5&cursor=$CURSOR"
show GET '/v1/feed/books?cursor=not-a-cursor'

echo
echo "Same script, other server:"
if [[ "$BASE" == *8000* ]]; then
  echo "  ./demos/live-demo.sh http://127.0.0.1:8001"
else
  echo "  ./demos/live-demo.sh http://127.0.0.1:8000"
fi
