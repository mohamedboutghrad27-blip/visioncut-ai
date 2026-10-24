#!/usr/bin/env python3
"""State check for Claude UGC Ads: MCP tools, target project, Kie balance."""
import json
import urllib.request

MCP = "https://visioncut-ai-mu.vercel.app/api/mcp?key=YOUR_MCP_KEY"
KIE_KEY = "af5e7acdb9f867708283ad4438f8f86a"
_i = [0]

def rpc(method, params=None):
    _i[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _i[0], "method": method, **({"params": params} if params is not None else {})}).encode()
    req = urllib.request.Request(MCP, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=150) as r:
        raw = r.read().decode()
    if raw.startswith("{"):
        return json.loads(raw)
    for line in raw.splitlines():
        if line.startswith("data:"):
            p = line[5:].strip()
            if p:
                return json.loads(p)
    raise RuntimeError(f"unparseable: {raw[:200]}")

def text_of(resp):
    return "\n".join(b.get("text", "") for b in resp["result"]["content"] if b.get("type") == "text")

# 1) tool inventory
init = rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ugc-state", "version": "1.0"}})
tl = rpc("tools/list")
names = [t["name"] for t in tl["result"]["tools"]]
print("TOOLS:", names)

# import_media schema (size/type limits?)
for t in tl["result"]["tools"]:
    if t["name"] == "visioncut_import_media":
        print("\nimport_media schema:", json.dumps(t.get("inputSchema", {}), indent=1)[:900])

# 2) projects — find Claude UGC Ads
lp = rpc("tools/call", {"name": "visioncut_list_projects", "arguments": {"limit": 10}})
print("\nPROJECTS:\n", text_of(lp)[:1500])

# 3) Kie balance
try:
    req = urllib.request.Request("https://api.kie.ai/api/v1/chat/credit", headers={"Authorization": f"Bearer {KIE_KEY}"})
    bal = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
    print("\nKIE CREDITS:", bal)
except Exception as e:
    print("\nKIE CREDITS: error", e)
