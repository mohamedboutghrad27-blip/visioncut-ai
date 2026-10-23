#!/bin/bash
# Production E2E for the MCP endpoint (uses MCP_TOKEN from .env).
# Usage: set -a; source .env; set +a; bash scripts/test-mcp-prod.sh
set -e
BASE="https://visioncut-ai-mu.vercel.app/api/mcp"
KEY="${MCP_TOKEN:?MCP_TOKEN must be set}"
P() { python3 -c "$1"; }

echo "== 1) unauthorized (expect 401) =="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'

echo "== 2) initialize + tools/list =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"e2e","version":"0"}}}' | P "
import json,sys; d=json.load(sys.stdin)['result']
print('server:', d['serverInfo'], '| protocol:', d['protocolVersion'])
"
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | P "
import json,sys; t=json.load(sys.stdin)['result']['tools']
print(len(t),'tools:', ', '.join(x['name'] for x in t)); assert len(t)==11
"

echo "== 3) visioncut_status =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"visioncut_status","arguments":{}}}' | P "
import json,sys; r=json.load(sys.stdin)['result']
print(r['content'][0]['text']); assert not r.get('isError')
"

echo "== 4) visioncut_list_projects =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"visioncut_list_projects","arguments":{"limit":5}}}' | P "
import json,sys; r=json.load(sys.stdin)['result']
print(r['content'][0]['text'][:400]); assert not r.get('isError'), r
"

echo "== 5) visioncut_search_stickers (arabic) =="
curl -s -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"visioncut_search_stickers","arguments":{"query":"صاروخ","limit":3}}}' | P "
import json,sys; r=json.load(sys.stdin)['result']; t=r['content'][0]['text']
print(t[:350]); assert not r.get('isError') and 'jsdelivr' in t
"

echo "== 6) visioncut_generate_storyboard =="
curl -s --max-time 150 -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"visioncut_generate_storyboard","arguments":{"script":"A young Moroccan surfer wakes before dawn in Taghazout, checks the swell, and paddles out at Anchor Point as the sun rises over the Atlas mountains.","style":"cinematic"}}}' | P "
import json,sys; r=json.load(sys.stdin)['result']; t=r['content'][0]['text']
print(t.split(chr(10))[0]); assert not r.get('isError'), t[:300]; assert '\"scenes\"' in t
"

echo "== 7) visioncut_generate_image (mcp image block) =="
curl -s --max-time 150 -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"visioncut_generate_image","arguments":{"prompt":"A Moroccan surfer at dawn, golden light, cinematic","aspect_ratio":"16:9"}}}' | P "
import json,sys,base64; r=json.load(sys.stdin)['result']
blocks=r['content']; img=[b for b in blocks if b['type']=='image'][0]
raw=base64.b64decode(img['data']); open('/home/z/my-project/scripts/mcp-prod-image.jpg','wb').write(raw)
print('image block:', img['mimeType'], len(raw), 'bytes | meta:', blocks[-1]['text'][:140])
assert len(raw)>10000 and not r.get('isError')
"

echo "== 8) visioncut_start_video -> check_video (poll) =="
TASK=$(curl -s --max-time 120 -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"visioncut_start_video","arguments":{"prompt":"A red paper airplane flying over the Atlas mountains at sunset, cinematic","duration":5,"quality":"speed"}}}' | P "
import json,sys,re; r=json.load(sys.stdin)['result']; t=r['content'][0]['text']
print(re.search(r'task_id: (\S+)',t).group(1)); assert not r.get('isError'), t[:300]
")
echo "task: $TASK"
for i in $(seq 1 40); do
  OUT=$(curl -s --max-time 60 -X POST "$BASE?key=$KEY" -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{\"name\":\"visioncut_check_video\",\"arguments\":{\"task_id\":\"$TASK\"}}}")
  ST=$(echo "$OUT" | P "import json,sys,re; t=json.load(sys.stdin)['result']['content'][0]['text']; print((re.search(r'Status: (\w+)',t) or [None,'?'])[1])")
  echo "poll $i: $ST"
  if [ "$ST" = "SUCCESS" ] || [ "$ST" = "FAILED" ]; then echo "$OUT" | P "import json,sys; print(json.load(sys.stdin)['result']['content'][0]['text'][:400])"; break; fi
  sleep 8
done
[ "$ST" = "SUCCESS" ] || { echo "VIDEO DID NOT COMPLETE"; exit 1; }
echo "PROD MCP E2E PASSED"
