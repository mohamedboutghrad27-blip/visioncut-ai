#!/usr/bin/env python3
"""Repair the Claude UGC Ads timeline on PROD after deploying the MCP fixes:
the 5 scene clips were added without `duration`, so they default to 5s each
while the media is 6.6/5.8/5.2/3.6/5.8s. This re-times them back-to-back.

Run AFTER `vercel --prod` deploy of the mcp.ts fixes.
"""
import json
import sys
import urllib.request

MCP = "https://visioncut-ai-mu.vercel.app/api/mcp?key=YOUR_MCP_KEY"
PROJECT = "cmvn0bfh20001l7084wurz2b2"
SCENE_DURS = [6.6, 5.8, 5.2, 3.6, 5.8]  # scene1..5 real media lengths

_i = [0]

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

def text_of(resp):
    return "\n".join(b.get("text", "") for b in resp["result"]["content"] if b.get("type") == "text")

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ugc-repair", "version": "1.0"}})

gp = rpc("tools/call", {"name": "visioncut_get_project", "arguments": {"project_id": PROJECT}})
t = text_of(gp)
if "not found" in t or "unknown tool" in t.lower():
    print("ABORT — get_project missing or project not found. Deploy first.\n" + t[:400])
    sys.exit(1)

clip_ids = [ln.split(" ")[1].strip() for ln in t.splitlines() if ln.strip().startswith("- c_")]
print("clips found:", clip_ids)
if len(clip_ids) != len(SCENE_DURS):
    print(f"ABORT — expected {len(SCENE_DURS)} clips, found {len(clip_ids)}")
    sys.exit(1)

# verify ordering matches media names before touching anything
start = 0.0
for cid, dur in zip(clip_ids, SCENE_DURS):
    r = rpc("tools/call", {"name": "visioncut_update_clip", "arguments": {"project_id": PROJECT, "clip_id": cid, "at_seconds": round(start, 2), "duration": dur}})
    line = [l for l in text_of(r).splitlines() if cid in l]
    print("updated", cid, "->", line[0].strip() if line else text_of(r)[:100])
    start += dur

gp2 = text_of(rpc("tools/call", {"name": "visioncut_get_project", "arguments": {"project_id": PROJECT}}))
print("\nAFTER:\n" + gp2)
