#!/usr/bin/env python3
"""Import the 5 Claude UGC scene clips into VisionCut and place them on the timeline in order."""
import json
import sys
import urllib.request

MCP = "https://visioncut-ai-mu.vercel.app/api/mcp?key=YOUR_MCP_KEY"
PROJECT = "cmvn0bfh20001l7084wurz2b2"  # Claude UGC Ads (9:16)

CLIPS = [
    ("Scene 1 — Hook: Drowning in emails", "https://tmpfiles.org/dl/wBARVjfbbABY/scene1.mp4", 6.6),
    ("Scene 2 — Email drafted in seconds", "https://tmpfiles.org/dl/woAuVMfrbnkp/scene2.mp4", 5.8),
    ("Scene 3 — Long doc? Summarized.", "https://tmpfiles.org/dl/woASVCf3bzmj/scene3.mp4", 5.2),
    ("Scene 4 — Actually caught up", "https://tmpfiles.org/dl/w3AaVpfJbqPt/scene4.mp4", 3.6),
    ("Scene 5 — CTA: Try Claude", "https://tmpfiles.org/dl/wWATVTfpbVNT/scene5.mp4", 5.8),
]

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

def field(t, key):
    return next((ln.split(key)[1].strip() for ln in t.splitlines() if key in ln), None)

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ugc-build", "version": "1.0"}})

media_ids = []
for name, url, dur in CLIPS:
    im = rpc("tools/call", {"name": "visioncut_import_media", "arguments": {
        "url": url, "name": f"Claude UGC — {name}", "duration_seconds": dur}})
    t = text_of(im)
    if im["result"].get("isError"):
        print(f"[FAIL] import {name}: {t[:300]}")
        sys.exit(1)
    mid = field(t, "media_id:") or field(t, "asset_id:")
    print(f"[OK] import {name} -> {mid}")
    media_ids.append(mid)

for name, mid in zip([c[0] for c in CLIPS], media_ids):
    ap = rpc("tools/call", {"name": "visioncut_add_to_project", "arguments": {"project_id": PROJECT, "media_id": mid}})
    t = text_of(ap)
    status = "OK" if not ap["result"].get("isError", False) else "FAIL"
    print(f"[{status}] add {name}: {t.splitlines()[0][:110] if t else ''}")

lp = rpc("tools/call", {"name": "visioncut_list_projects", "arguments": {"limit": 5}})
t = text_of(lp)
for ln in t.splitlines():
    if PROJECT in ln:
        print("VERIFY:", ln.strip())
