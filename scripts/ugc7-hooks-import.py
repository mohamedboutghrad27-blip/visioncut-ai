#!/usr/bin/env python3
"""Import the 2 alt-hook clips into the VisionCut cloud library (not on timeline)."""
import json
import urllib.request

MCP = "https://visioncut-ai-mu.vercel.app/api/mcp?key=YOUR_MCP_KEY"
_i = [0]

def rpc(method, params=None):
    _i[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _i[0], "method": method, **({"params": params} if params is not None else {})}).encode()
    req = urllib.request.Request(MCP, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=300) as r:
        raw = r.read().decode()
    if raw.startswith("{"):
        return json.loads(raw)
    for line in raw.splitlines():
        if line.startswith("data:"):
            p = line[5:].strip()
            if p:
                return json.loads(p)
    raise RuntimeError("unparseable: " + raw[:200])

def text_of(resp):
    return "\n".join(b.get("text", "") for b in resp["result"]["content"] if b.get("type") == "text")

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ugc-hooks-import", "version": "1.0"}})

for name, url, dur in [
    ("Alt hook B — POV: 47 unread emails", "https://tmpfiles.org/dl/wVAjVIfcRRXr/hookb.mp4", 6.6),
    ("Alt hook C — My inbox was a disaster", "https://tmpfiles.org/dl/wuAWV1fLRkjo/hookc.mp4", 5.9),
]:
    im = rpc("tools/call", {"name": "visioncut_import_media", "arguments": {
        "url": url, "name": f"Claude UGC — {name}", "duration_seconds": dur}})
    t = text_of(im)
    tag = "OK" if not im["result"].get("isError", False) else "FAIL"
    aid = next((ln.split("asset_id:")[1].strip() for ln in t.splitlines() if "asset_id:" in ln), "-")
    print(f"[{tag}] {name}: asset={aid}")
