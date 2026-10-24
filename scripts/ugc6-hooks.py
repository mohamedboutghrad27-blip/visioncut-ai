#!/usr/bin/env python3
"""Two alternate hooks for A/B testing: VO (free TTS) -> compose with music+caption -> import to library."""
import base64
import json
import subprocess
import urllib.request

MCP = "https://visioncut-ai-mu.vercel.app/api/mcp?key=YOUR_MCP_KEY"
BASE = "/home/z/my-project/download/claude-ugc"
STOCK = f"{BASE}/stock"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

HOOKS = [
    dict(key="hookB", text="Forty-seven unread emails and a deadline in one hour. Sound familiar?",
         caption="POV: 47 unread emails", src=f"{STOCK}/mixkit-39812-1080.mp4", seek=1.0),
    dict(key="hookC", text="My inbox was a total disaster. Then I found this.",
         caption="My inbox was a disaster", src=f"{STOCK}/mixkit-43269-720.mp4", seek=1.5),
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

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ugc-hooks", "version": "1.0"}})

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("CMD FAILED:", " ".join(cmd)[:300], "\n", r.stderr[-800:])
        raise SystemExit(1)

for h in HOOKS:
    vo = rpc("tools/call", {"name": "visioncut_generate_voiceover", "arguments": {"text": h["text"], "voice": "female"}})
    content = vo["result"]["content"]
    audio = next((b for b in content if b.get("type") == "audio" and b.get("data")), None)
    if not audio:
        print(f"[FAIL] vo {h['key']}")
        raise SystemExit(1)
    vo_path = f"{BASE}/{h['key']}-vo.mp3"
    with open(vo_path, "wb") as f:
        f.write(base64.b64decode(audio["data"]))
    vodur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", vo_path],
                                 capture_output=True, text=True).stdout.strip())
    dur = round(min(7.5, max(5.0, vodur + 1.1)), 1)
    esc = h["caption"].replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")
    vf = (f"scale=1080:1920:flags=lanczos,unsharp=5:5:0.4:5:5:0.0,eq=contrast=1.05:saturation=1.14,"
          f"drawtext=fontfile={FONT}:text='{esc}':fontsize=78:fontcolor=white:borderw=6:bordercolor=black@0.85:"
          f"shadowx=0:shadowy=6:shadowcolor=black@0.5:x=(w-text_w)/2:y=h-560,fps=30,format=yuv420p")
    af = (f"[1:a]volume=0.30,atrim=0:{dur}[mus];"
          f"[2:a]volume=2.0,adelay=300|300[vo];"
          f"[mus][vo]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.88[a]")
    out = f"{BASE}/{h['key']}.mp4"
    run(["ffmpeg", "-y", "-v", "error",
         "-ss", str(h["seek"]), "-t", str(dur), "-i", h["src"],
         "-ss", "0", "-t", str(dur + 0.5), "-i", f"{BASE}/music.wav",
         "-i", vo_path,
         "-filter_complex", f"[0:v]{vf}[v];{af}",
         "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "21",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", out])
    print(f"[OK] {h['key']}.mp4  dur={dur}s  vo={vodur:.2f}s  caption='{h['caption']}'")

    # host + import to library
    up = subprocess.run(["curl", "-s", "--max-time", "120", "-F", f"file=@{out}",
                         "-H", "User-Agent: Mozilla/5.0 VisionCutImport/1.0",
                         "https://tmpfiles.org/api/v1/upload"], capture_output=True, text=True).stdout
    page = json.loads(up)["data"]["url"]
    direct = page.replace("tmpfiles.org/", "tmpfiles.org/dl/")
    im = rpc("tools/call", {"name": "visioncut_import_media", "arguments": {
        "url": direct, "name": f"Claude UGC — Alt hook {h['key'][-1].upper()}", "duration_seconds": dur}})
    t = text_of(im)
    tag = "OK" if not im["result"].get("isError", False) else "FAIL"
    print(f"[{tag}] import {h['key']}: {t.splitlines()[0][:100]}")
