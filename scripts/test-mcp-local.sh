#!/bin/bash
# Local E2E for the MCP endpoint against a locally started production server.
# Usage: set -a; source .env; set +a; bash scripts/test-mcp-local.sh
set -e
PORT=3111
BASE="http://127.0.0.1:$PORT/api/mcp"
KEY="${MCP_TOKEN:?MCP_TOKEN must be set}"
J() { python3 -m json.tool 2>/dev/null | head -"$1"; }

echo "== starting next start on :$PORT =="
npx next start -p $PORT >/tmp/mcp-server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 1; done

echo "== 1) unauthorized (no key) =="
curl -s -o /dev/null -w "HTTP %{http_code} (expect 401)\n" -X POST "$BASE" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'

echo "== 2) initialize =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}' | J 14

echo "== 3) notifications/initialized (expect 202) =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

echo "== 4) tools/list (names only) =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
tools=d['result']['tools']
print(len(tools),'tools:', ', '.join(t['name'] for t in tools))
assert len(tools)==11
"

echo "== 5) tools/call visioncut_status =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"visioncut_status","arguments":{}}}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d['result']
print(r['content'][0]['text'][:600])
assert not r.get('isError')
"

echo "== 6) tools/call visioncut_search_stickers =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"visioncut_search_stickers","arguments":{"query":"قطة","limit":3}}}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d['result']
t=r['content'][0]['text']
print(t[:400])
assert not r.get('isError') and 'cdn.jsdelivr.net' in t
"

echo "== 7) tools/call visioncut_list_projects =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"visioncut_list_projects","arguments":{"limit":5}}}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d['result']
print(r['content'][0]['text'][:300])
"

echo "== 8) unknown method (expect -32601) =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"resources/list"}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('error:', d['error']['code'], d['error']['message'])
assert d['error']['code']==-32601
"

echo "== 9) batch: ping + initialized =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '[{"jsonrpc":"2.0","id":7,"method":"ping"},{"jsonrpc":"2.0","method":"notifications/initialized"}]'

echo "LOCAL MCP TESTS PASSED"
