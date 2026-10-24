#!/usr/bin/env python3
"""Generate 5 English VO lines via free visioncut TTS; save locally + measure."""
import base64
import json
import subprocess
import urllib.request

MCP = "https://visioncut-ai-mu.vercel.app/api/mcp?key=YOUR_MCP_KEY"
OUT = "/home/z/my-project/download/claude-ugc"
_i = [0]

LINES = [
    ("vo1", "I was drowning in emails and a messy doc, until a friend told me to try Claude."),
    ("vo2", "Look at this. A clear, solid reply, drafted in seconds."),
    ("vo3", "And my giant doc? Summarized before my coffee was done."),
    ("vo4", "Now I'm actually caught up."),
    ("vo5", "Seriously, just try it. Claude. Free to start."),
]

def rpc(method, params=None):
    _i[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _i[0], "method": method, **({"params": params} if params is not None else {})}).encode()
    req = urllib.request.Request(MCP, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read().decode()
    if raw.startswith("{"):
        return json.loads(raw)
    for line in raw.splitlines():
        if line.startswith("data:"):
            p = line[5:].strip()
            if p:
                return json.loads(p)
    raise RuntimeError("unparseable: " + raw[:200])

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ugc-vo", "version": "1.0"}})

for name, text in LINES:
    resp = rpc("tools/call", {"name": "visioncut_generate_voiceover", "arguments": {"text": text, "voice": "female"}})
    content = resp["result"]["content"]
    t = "\n".join(b.get("text", "") for b in content if b.get("type") == "text")
    audio = next((b for b in content if b.get("type") == "audio" and b.get("data")), None)
    if resp["result"].get("isError") or not audio:
        print(f"[FAIL] {name}: {t[:200]}")
        continue
    path = f"{OUT}/{name}.mp3"
    with open(path, "wb") as f:
        f.write(base64.b64decode(audio["data"]))
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    asset = next((ln.split("asset_id:")[1].strip() for ln in t.splitlines() if "asset_id:" in ln), "-")
    print(f"[OK] {name}: {dur}s  asset={asset}  ({t.splitlines()[0][:60]})")
