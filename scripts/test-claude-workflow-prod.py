#!/usr/bin/env python3
"""Prod E2E replicating Claude's exact failed workflow — now at $0 balance:
generate_image (free engine) -> AUTO-SAVED to library -> asset_id
create_project -> add_to_project (no public URL needed) -> list_projects shows clip
generate_voiceover (free engine) -> AUTO-SAVED -> placed on audio track
"""
import json
import sys
import urllib.request

URL = "https://visioncut-ai-mu.vercel.app/api/mcp?key=3990c73d0097cc04e7286974d3f89a45ac3a8c576b24fe8f"
_i = [0]

def rpc(method, params=None):
    _i[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _i[0], "method": method, **({"params": params} if params is not None else {})}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
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

def blocks(resp):
    return resp["result"]["content"]

def text_of(resp):
    return "\n".join(b.get("text", "") for b in blocks(resp) if b.get("type") == "text")

def step(name, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        sys.exit(1)

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "claudework-e2e", "version": "1.0"}})

# 1) generate_image — free engine, auto-save (default), NO public URL needed
im = rpc("tools/call", {"name": "visioncut_generate_image", "arguments": {
    "prompt": "A glass bottle of cola on a café table in warm sunlight, condensation drops, product photography", "aspect_ratio": "16:9"}})
t = text_of(im)
has_img = any(b.get("type") == "image" and b.get("data") for b in blocks(im))
step("generate_image (free + auto-save)", not im["result"].get("isError", False) and has_img and "provider=pollinations" in t, t.splitlines()[0][:110] if t else "")
asset_img = next((ln.split("asset_id:")[1].strip() for ln in t.splitlines() if "asset_id:" in ln), None)
step("image asset_id returned", bool(asset_img and asset_img.startswith("as_")), str(asset_img))

# 2) create project (or reuse the Coca-Cola UGC Ads one if present)
cp = rpc("tools/call", {"name": "visioncut_create_project", "arguments": {"name": "Claude Flow E2E", "aspect_ratio": "16:9"}})
t = text_of(cp)
step("create_project", not cp["result"].get("isError", False))
project_id = next((ln.split("project_id:")[1].strip() for ln in t.splitlines() if "project_id:" in ln), None)

# 3) add the AI image to the timeline — THE step that was impossible before
ap = rpc("tools/call", {"name": "visioncut_add_to_project", "arguments": {"project_id": project_id, "media_id": asset_img}})
t = text_of(ap)
step("add_to_project (AI image, no URL)", not ap["result"].get("isError", False), t.splitlines()[0][:100] if t else "")

# 4) generate_voiceover (free google engine) + auto-save + place on audio track
vo = rpc("tools/call", {"name": "visioncut_generate_voiceover", "arguments": {"text": "طعم أصلي لا يُقاوم", "voice": "female"}})
t = text_of(vo)
has_audio = any(b.get("type") == "audio" and b.get("data") for b in blocks(vo))
step("generate_voiceover (free + auto-save)", not vo["result"].get("isError", False) and has_audio and "provider=google" in t, t.splitlines()[0][:110] if t else "")
asset_audio = next((ln.split("asset_id:")[1].strip() for ln in t.splitlines() if "asset_id:" in ln), None)
step("voiceover asset_id returned", bool(asset_audio and asset_audio.startswith("as_")), str(asset_audio))
ap2 = rpc("tools/call", {"name": "visioncut_add_to_project", "arguments": {"project_id": project_id, "media_id": asset_audio}})
t = text_of(ap2)
step("add_to_project (audio track)", not ap2["result"].get("isError", False), t.splitlines()[0][:100] if t else "")

# 5) verify timeline state
lp = rpc("tools/call", {"name": "visioncut_list_projects", "arguments": {"limit": 3}})
t = text_of(lp)
line = next((ln for ln in t.splitlines() if project_id in ln), "")
step("list_projects shows 2 clips", bool(line and "2 clips" in line), line.strip())

print("\nCLAUDE-WORKFLOW E2E PASSED (production, $0 balance)")
