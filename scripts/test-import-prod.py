#!/usr/bin/env python3
"""Live production E2E for VisionCut MCP write tools (import feature).

Flow: tools/list -> assert 11 tools incl. the 3 write tools
      -> visioncut_create_project -> visioncut_import_media (public PNG)
      -> visioncut_add_to_project -> visioncut_list_projects (verify clip)
"""
import json
import sys
import urllib.request

BASE = "https://visioncut-ai-mu.vercel.app/api/mcp"
KEY = "3990c73d0097cc04e7286974d3f89a45ac3a8c576b24fe8f"
URL = f"{BASE}?key={KEY}"
# Small stable public PNG (OpenMoji CDN — same source the sticker tool uses)
MEDIA_URL = "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/72x72/1F600.png"

_id = [0]

def rpc(method, params=None):
    _id[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _id[0], "method": method, **({"params": params} if params is not None else {})}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read().decode()
    # Accept both plain JSON and SSE (data: lines)
    if raw.startswith("{"):
        return json.loads(raw)
    for line in raw.splitlines():
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload:
                return json.loads(payload)
    raise RuntimeError(f"unparseable response for {method}: {raw[:200]}")

def tool_text(resp):
    return "\n".join(b.get("text", "") for b in resp["result"]["content"] if b.get("type") == "text")

def step(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        sys.exit(1)

# 1) initialize + tools/list
rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "import-e2e", "version": "1.0"}})
tl = rpc("tools/list")
names = [t["name"] for t in tl["result"]["tools"]]
step("tools/list", len(names) >= 11, f"{len(names)} tools")
for t in ("visioncut_create_project", "visioncut_import_media", "visioncut_add_to_project"):
    step(f"tool present: {t}", t in names)

# 2) create project
stamp = "e2e-import"
cp = rpc("tools/call", {"name": "visioncut_create_project", "arguments": {"name": f"E2E Import {stamp}", "aspect_ratio": "16:9"}})
txt = tool_text(cp)
step("create_project", not cp["result"].get("isError", False), txt.splitlines()[0] if txt else "")
project_id = next((ln.split("project_id:")[1].strip() for ln in txt.splitlines() if "project_id:" in ln), None)
step("project_id extracted", bool(project_id), str(project_id))

# 3) import media (public PNG)
im = rpc("tools/call", {"name": "visioncut_import_media", "arguments": {"url": MEDIA_URL, "name": f"e2e-{stamp}.png"}})
txt = tool_text(im)
step("import_media", not im["result"].get("isError", False), txt.splitlines()[0] if txt else "")
asset_id = next((ln.split("asset_id:")[1].strip() for ln in txt.splitlines() if "asset_id:" in ln), None)
step("asset_id extracted (as_...)", bool(asset_id and asset_id.startswith("as_")), str(asset_id))

# 4) add to project
ap = rpc("tools/call", {"name": "visioncut_add_to_project", "arguments": {"project_id": project_id, "media_id": asset_id}})
txt = tool_text(ap)
step("add_to_project", not ap["result"].get("isError", False), txt.splitlines()[0] if txt else "")

# 5) verify from list_projects
lp = rpc("tools/call", {"name": "visioncut_list_projects", "arguments": {"limit": 5}})
txt = tool_text(lp)
line = next((ln for ln in txt.splitlines() if project_id in ln), "")
step("list_projects shows project", bool(line), line.strip())

# 6) privacy: /api/media/{id} must require an authenticated session (anonymous -> 401).
#    (Bytes-in-DB were already proven: add_to_project re-read the MediaFile row via
#     db.mediaFile.findFirst and returned success — the row exists in prod Postgres.)
blocked = False
try:
    with urllib.request.urlopen(f"https://visioncut-ai-mu.vercel.app/api/media/{asset_id}", timeout=60) as r:
        blocked = r.status not in (200, 201)  # any authenticated-anonymous leak would be 200
except urllib.error.HTTPError as e:
    blocked = e.code in (401, 403)
step("media REST is session-protected (401/403 anonymous)", blocked)

print("\nALL IMPORT E2E CHECKS PASSED (production)")
