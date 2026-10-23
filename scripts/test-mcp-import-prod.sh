#!/bin/bash
# Production E2E for the MCP WRITE tools: create project -> import media (real MP4 + PNG)
# -> add both to the timeline -> verify via the app's own REST endpoints.
# Usage: set -a; source .env.local; set +a; bash scripts/test-mcp-import-prod.sh
set -e
BASE="https://visioncut-ai-mu.vercel.app"
MCP="$BASE/api/mcp"
KEY="${MCP_TOKEN:?MCP_TOKEN must be set}"
P() { python3 -c "$1"; }

SCENE2="https://d2h7xmz5gqybh9.cloudfront.net/output/afbe8923-c5e5-47f0-bf48-01efad412919-u2_62d3fc96-e371-4d81-a681-11b49b579bb6.mp4"
STICKER="https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@latest/color/618x618/1F680.png"

call() { # call <tool> <json-args> -> prints text
  curl -s --max-time 150 -X POST "$MCP?key=$KEY" -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}" \
    | P "import json,sys; r=json.load(sys.stdin)['result']; t=r['content'][0]['text']; print(t); sys.exit(1 if r.get('isError') else 0)"
}

echo "== 1) tools/list count =="
curl -s -X POST "$MCP?key=$KEY" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | P "
import json,sys; t=json.load(sys.stdin)['result']['tools']
print(len(t),'tools'); assert len(t)==11
"

echo "== 2) create project =="
OUT=$(call visioncut_create_project '{"name":"Claude Import Test","aspect_ratio":"16:9"}')
PROJ=$(echo "$OUT" | P "import re,sys; t=sys.stdin.read(); print(re.search(r'project_id: (\S+)',t).group(1))")
echo "project: $PROJ"

echo "== 3) import real MP4 (scene2, 6.7MB) =="
OUT=$(call visioncut_import_media "{\"url\":\"$SCENE2\",\"name\":\"Surfer scene 2\",\"duration_seconds\":5}")
MEDIA1=$(echo "$OUT" | P "import re,sys; t=sys.stdin.read(); print(re.search(r'asset_id: (\S+)',t).group(1))")
echo "video asset: $MEDIA1"

echo "== 4) import PNG sticker =="
OUT=$(call visioncut_import_media "{\"url\":\"$STICKER\",\"name\":\"Rocket sticker\"}")
MEDIA2=$(echo "$OUT" | P "import re,sys; t=sys.stdin.read(); print(re.search(r'asset_id: (\S+)',t).group(1))")
echo "image asset: $MEDIA2"

echo "== 5) add video clip at 0s (5s) =="
call visioncut_add_to_project "{\"project_id\":\"$PROJ\",\"media_id\":\"$MEDIA1\",\"at_seconds\":0,\"duration\":5}" | head -3

echo "== 6) add image clip at 5s (4s) =="
call visioncut_add_to_project "{\"project_id\":\"$PROJ\",\"media_id\":\"$MEDIA2\",\"at_seconds\":5,\"duration\":4}" | head -3

echo "== 7) verify via app REST (demo session) =="
curl -s -c /tmp/ck2.txt -X POST "$BASE/api/auth/demo" -H "Content-Type: application/json" -o /dev/null
curl -s -b /tmp/ck2.txt "$BASE/api/projects/$PROJ" | P "
import json,sys
row=json.load(sys.stdin)['project']
state=json.loads(row['data'])
print('project:', row['name'], '| tracks:', [t['id'] for t in state['tracks']])
print('clips:', [(c['type'], c['assetId'], c['start'], c['duration']) for c in state['clips']])
print('assets:', [(a['id'], a['kind'], a['origin']) for a in state['assets']])
assert len(state['clips'])==2 and len(state['assets'])==2
"

echo "== 8) verify cloud restore endpoints return real bytes =="
curl -s -b /tmp/ck2.txt "$BASE/api/media/$MEDIA1" -o /tmp/restored.mp4 -w "video: HTTP %{http_code}, %{size_download} bytes, %{content_type}\n"
curl -s -b /tmp/ck2.txt "$BASE/api/media/$MEDIA2" -o /tmp/restored.png -w "image: HTTP %{http_code}, %{size_download} bytes, %{content_type}\n"
file /tmp/restored.mp4 /tmp/restored.png | sed 's/, / /g'

echo "IMPORT PROD E2E PASSED"
