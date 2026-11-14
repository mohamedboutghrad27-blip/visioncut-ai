#!/usr/bin/env python3
"""Local E2E for the FIXED/new MCP tools against localhost (sqlite file db).
Tests: get_project, update_clip, remove_clip, aspect_ratio passthrough, duration warning."""
import json
import base64
import sys
import urllib.request

MCP = "http://localhost:3000/api/mcp?key=localtest"
_i = [0]
PASS = 0
FAIL = 0

def rpc(method, params=None):
    _i[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _i[0], "method": method, **({"params": params} if params is not None else {})}).encode()
    req = urllib.request.Request(MCP, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode()
    if raw.startswith("{"):
        return json.loads(raw)
    for line in raw.splitlines():
        if line.startswith("data:"):
            p = line[5:].strip()
            if p:
                return json.loads(p)
    raise RuntimeError("unparseable: " + raw[:200])

def call(name, args):
    return rpc("tools/call", {"name": name, "arguments": args})

def text_of(resp):
    return "\n".join(b.get("text", "") for b in resp["result"]["content"] if b.get("type") == "text")

def field(t, key):
    return next((ln.split(key)[1].strip() for ln in t.splitlines() if key in ln), None)

def step(ok, label, detail=""):
    global PASS, FAIL
    PASS += ok
    FAIL += not ok
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail[:130]}" if detail else ""))

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "local-e2e", "version": "1.0"}})

tl = rpc("tools/list")
names = [t["name"] for t in tl["result"]["tools"]]
step("visioncut_get_project" in names and "visioncut_update_clip" in names and "visioncut_remove_clip" in names,
     "tools/list exposes 3 new tools", f"total tools: {len(names)}")

# 1) create 9:16 project — state aspectRatio must match table
cp = call("visioncut_create_project", {"name": "MCP Fix E2E", "aspect_ratio": "9:16"})
pid = field(text_of(cp), "project_id:")
step(bool(pid), "create_project (9:16)", pid or text_of(cp)[:80])

gp = call("visioncut_get_project", {"project_id": pid})
gt = text_of(gp)
step("aspect_ratio: state=9:16" in gt, "get_project: state aspectRatio = 9:16 (was hardcoded 16:9 before)",
     [l for l in gt.splitlines() if "aspect_ratio" in l][0] if "aspect_ratio" in gt else "")
step("no clips yet" in gt, "get_project: empty timeline message")

# 2) tiny image -> library -> add (image default 4s)
im = call("visioncut_generate_image", {"prompt": "A tiny red cube on white background, product shot", "aspect_ratio": "1:1"})
aid = field(text_of(im), "asset_id:")
step(bool(aid), "generate_image -> asset", aid or "")
ap = call("visioncut_add_to_project", {"project_id": pid, "media_id": aid})
apt = text_of(ap)
c1 = field(apt, "clip_id:")
step(bool(c1), "add_to_project (image)", c1 or apt[:80])
gp2 = text_of(call("visioncut_get_project", {"project_id": pid}))
step("duration=4.00s" in gp2, "get_project: image clip got 4s default", [l for l in gp2.splitlines() if c1 in l][0] if c1 else "")

# 3) update_clip: retime image clip to start 2s dur 6
uc = call("visioncut_update_clip", {"project_id": pid, "clip_id": c1, "at_seconds": 2, "duration": 6})
uct = text_of(uc)
step("start=2.00s duration=6.00s" in uct and "total duration: 8.00s" in uct, "update_clip retime", uct.splitlines()[1] if uct.count("\n") else uct[:100])

# 4) add a second clip at end then remove first with shift
ap2 = call("visioncut_add_to_project", {"project_id": pid, "media_id": aid, "duration": 3})
c2 = field(text_of(ap2), "clip_id:")
step(bool(c2), "add second clip (explicit duration=3)")
rc = call("visioncut_remove_clip", {"project_id": pid, "clip_id": c1})
rct = text_of(rc)
step("removed" in rct and "shifted left" in rct, "remove_clip with shift", rct.splitlines()[0][:90])
gp3 = text_of(call("visioncut_get_project", {"project_id": pid}))
c2line = [l for l in gp3.splitlines() if c2 in l]
# c1 sat at 2s->8s, c2 was at 8s; closing the gap moves c2 to 2s (removedStart).
step(bool(c2line) and "start=2.00s" in c2line[0], "remaining clip shifted to gap start (2s)", c2line[0][:120] if c2line else "")
step("total duration: 5.00s" in gp3, "project duration recomputed to 5s")

# 5) error paths
bad1 = call("visioncut_get_project", {"project_id": "cm_nonexistent000"})
step(text_of(bad1).startswith('Project "cm_nonexistent000" was not found'), "get_project clean 404-style error")
bad2 = call("visioncut_update_clip", {"project_id": pid, "clip_id": "c_missing"})
step("not found" in text_of(bad2) and "Existing clips" in text_of(bad2), "update_clip clean missing-clip error", text_of(bad2)[:90])
bad3 = call("visioncut_import_media", {"url": "http://127.0.0.1/secret.mp4"})
step("Private/loopback" in text_of(bad3), "import_media blocks loopback SSRF", text_of(bad3)[:70])
bad4 = call("visioncut_start_video", {"prompt": "test"})
step("credits" in text_of(bad4).lower() or "failed" in text_of(bad4).lower() or "provider" in text_of(bad4).lower(),
     "start_video surfaces honest provider error (no crash)", text_of(bad4).splitlines()[0][:90])

print(f"\nRESULT: {PASS} PASS / {FAIL} FAIL")
sys.exit(1 if FAIL else 0)
