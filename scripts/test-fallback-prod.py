#!/usr/bin/env python3
"""Prod E2E: verify fallback-aware status + engines on production (real key)."""
import json, urllib.request, sys

BASE = "https://visioncut-ai-mu.vercel.app/api/mcp?key=3990c73d0097cc04e7286974d3f89a45ac3a8c576b24fe8f"

def rpc(payload):
    req = urllib.request.Request(BASE, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.status, json.loads(r.read().decode())

def text_of(resp):
    for c in resp.get("result", {}).get("content", []):
        if c.get("type") == "text":
            return c["text"]
    return ""

ok = True

st, resp = rpc({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
    "name":"visioncut_status","arguments":{}}})
t = text_of(resp)
print(f"[1] status: HTTP {st}")
print(t)
ok &= "pollinations" in t and "balance" in t

st, resp = rpc({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
    "name":"visioncut_generate_image","arguments":{
        "prompt":"falcon flying over desert dunes at sunset","aspect_ratio":"16:9"}}})
t = text_of(resp)
has_img = any(c.get("type")=="image" for c in resp.get("result",{}).get("content",[]))
print(f"[2] generate_image: HTTP {st}, image_block={has_img}")
print("   ", t[:200])
ok &= has_img  # provider may be wavespeed (residual balance) or pollinations — both fine

print("\nRESULT:", "PASS ✅" if ok else "FAIL ❌")
sys.exit(0 if ok else 1)
