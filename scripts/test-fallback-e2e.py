#!/usr/bin/env python3
"""Local E2E: verify free-fallback engines engage when WaveSpeed fails (bogus key)."""
import json, urllib.request, sys

BASE = "http://localhost:3210/api/mcp"
TOKEN = "3990c73d0097cc04e7286974d3f89a45ac3a8c576b24fe8f"

def rpc(payload):
    req = urllib.request.Request(
        BASE, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, json.loads(r.read().decode())

def text_of(resp):
    for c in resp.get("result", {}).get("content", []):
        if c.get("type") == "text":
            return c["text"]
    return ""

ok = True

# 1. initialize
st, resp = rpc({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
    "protocolVersion":"2025-06-18","capabilities":{},
    "clientInfo":{"name":"fallback-e2e","version":"1.0"}}})
print(f"[1] initialize: HTTP {st}, server={resp['result']['serverInfo']['name']}")

# 2. status — balance + fallback lines
st, resp = rpc({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
    "name":"visioncut_status","arguments":{}}})
t = text_of(resp)
print(f"[2] status: HTTP {st}")
for line in t.splitlines():
    if "fallback" in line or "balance" in line:
        print("   ", line)
ok &= "pollinations" in t and "google-translate" in t and "balance" in t

# 3. generate_image — expect provider=pollinations (wavespeed 401 -> fallback)
st, resp = rpc({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
    "name":"visioncut_generate_image","arguments":{
        "prompt":"ancient arabic market at golden hour","aspect_ratio":"16:9"}}})
t = text_of(resp)
has_img = any(c.get("type")=="image" for c in resp.get("result",{}).get("content",[]))
print(f"[3] generate_image: HTTP {st}, image_block={has_img}")
print("   ", t[:220])
ok &= has_img and "pollinations" in t

# 4. generate_voiceover (Arabic) — expect provider=google-translate-tts
st, resp = rpc({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{
    "name":"visioncut_generate_voiceover","arguments":{
        "text":"مرحبا بكم في محرر الفيديو الذكي. هذه مقطع صوتي تجريبي من المحرك المجاني.",
        "voice":"female","quality":"fast"}}})
t = text_of(resp)
has_audio = any(c.get("type")=="audio" for c in resp.get("result",{}).get("content",[]))
print(f"[4] generate_voiceover: HTTP {st}, audio_block={has_audio}")
print("   ", t[:300])
ok &= has_audio and "google-translate" in t

print("\nRESULT:", "PASS ✅" if ok else "FAIL ❌")
sys.exit(0 if ok else 1)
