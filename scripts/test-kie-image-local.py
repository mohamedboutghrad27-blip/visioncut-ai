#!/usr/bin/env python3
"""Local E2E: pinned IMAGE_PROVIDER=kie -> visioncut_generate_image must return provider=kie."""
import json
import sys
import urllib.request

PORT = sys.argv[1] if len(sys.argv) > 1 else "3211"
TOKEN = "3990c73d0097cc04e7286974d3f89a45ac3a8c576b24fe8f"
URL = f"http://127.0.0.1:{PORT}/api/mcp?key={TOKEN}"

def rpc(method, params=None, id=1):
    body = json.dumps({"jsonrpc": "2.0", "id": id, "method": method, **({"params": params} if params is not None else {})}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode()
    if raw.startswith("{"):
        return json.loads(raw)
    for line in raw.splitlines():
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload:
                return json.loads(payload)
    raise RuntimeError(f"unparseable: {raw[:200]}")

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "kie-img-e2e", "version": "1.0"}}, id=0)
resp = rpc("tools/call", {"name": "visioncut_generate_image",
                          "arguments": {"prompt": "A cozy cabin in a snowy pine forest at dusk, warm window light, cinematic", "aspect_ratio": "16:9"}})
res = resp["result"]
blocks = res.get("content", [])
has_img = any(b.get("type") == "image" and b.get("data") for b in blocks)
text = " ".join(b.get("text", "") for b in blocks if b.get("type") == "text")
ok = not res.get("isError", False) and has_img and "provider=kie" in text
print(f"image block: {has_img}")
print(f"metadata: {text[:220]}")
print("KIE IMAGE E2E:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
