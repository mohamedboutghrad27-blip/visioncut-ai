#!/usr/bin/env python3
"""Probe Kie.AI authorization with the user's authorized model list (budget-aware).

Stage 0: negative control — NON-authorized model must still 401 (costs nothing)
Stage 1: seedream/5-flash-text-to-image  (~3.24 credits) — is the block lifted?
Stage 2: minimax-h3/text-to-video 5s (~40 credits) — ONLY if stage 1 succeeded
Stage 3: google/gemini-3-8-flash-lite-tts tiny text (~1-2 credits) — capability probe
"""
import json
import sys
import time
import urllib.request

KEY = "af5e7acdb9f867708283ad4438f8f86a"
BASE = "https://api.kie.ai/api/v1/jobs"

def post(payload):
    req = urllib.request.Request(
        f"{BASE}/createTask",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

def get(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode())

def credit():
    try:
        d = get("https://api.kie.ai/api/v1/chat/credit")
        return d.get("data")
    except Exception as e:
        return f"? ({e})"

def rec(task_id):
    return get(f"{BASE}/recordInfo?taskId={urllib.request.quote(task_id)}")

print(f"credits BEFORE: {credit()}")

# ---- Stage 0: negative control (free — expect 401) ----
st, b = post({"model": "nano-banana", "input": {"prompt": "a red apple on a table"}})
print(f"[stage0] nano-banana (NOT in plan): HTTP {st} code={b.get('code')} msg={b.get('msg','')[:90]}")

# ---- Stage 1: cheap authorized image (seedream 5 flash, ~3.24 cr) ----
st, b = post({"model": "seedream/5-flash-text-to-image",
              "input": {"prompt": "A cinematic wide shot of a lighthouse at golden hour, waves crashing, photorealistic", "aspect_ratio": "16:9"}})
print(f"[stage1] seedream/5-flash-t2i: HTTP {st} code={b.get('code')} msg={b.get('msg','')[:90]} resp={json.dumps(b)[:200]}")
if b.get("code") not in (None, 200):
    print("BLOCKED — account-level restriction persists for authorized models too. Stopping (no credits burned).")
    sys.exit(2)
seedream_task = (b.get("data") or {}).get("taskId")
print(f"[stage1] taskId={seedream_task}")

# ---- Stage 2: video via MiniMax H3 (~40 cr for 5s @768p) ----
st, b = post({"model": "minimax-h3/text-to-video",
              "input": {"prompt": "A drone shot flying over a desert oasis at sunset, cinematic, smooth motion", "duration": 5}})
print(f"[stage2] minimax-h3/t2v: HTTP {st} code={b.get('code')} msg={b.get('msg','')[:90]} resp={json.dumps(b)[:200]}")
video_task = (b.get("data") or {}).get("taskId")
print(f"[stage2] taskId={video_task}")

# ---- Stage 3: TTS capability probe (tiny) ----
st, b = post({"model": "google/gemini-3-8-flash-lite-tts",
              "input": {"text": "مرحبا", "voice": "Kore"}})
print(f"[stage3] gemini-3.8-flash-lite-tts: HTTP {st} code={b.get('code')} msg={b.get('msg','')[:90]} resp={json.dumps(b)[:200]}")
tts_task = (b.get("data") or {}).get("taskId")

# ---- Poll the submitted tasks up to ~4 min ----
def wait(task_id, label, seconds=240):
    if not task_id:
        return None
    t0 = time.time()
    while time.time() - t0 < seconds:
        try:
            r = rec(task_id)
            d = r.get("data") or {}
            state = d.get("state")
            if state == "success":
                rj = json.loads(d.get("resultJson") or "{}")
                urls = rj.get("resultUrls") or []
                print(f"[{label}] SUCCESS: {urls[0] if urls else rj}")
                return urls[0] if urls else None
            if state == "fail":
                print(f"[{label}] FAIL: {d.get('failMsg')}")
                return None
            print(f"[{label}] {state} ({int(time.time()-t0)}s)")
        except Exception as e:
            print(f"[{label}] poll error: {e}")
        time.sleep(15)
    print(f"[{label}] timeout after {seconds}s")
    return None

img_url = wait(seedream_task, "seedream")
vid_url = wait(video_task, "minimax-video", seconds=300)
tts_url = wait(tts_task, "tts", seconds=120)

print(f"credits AFTER: {credit()}")
print(json.dumps({"image": img_url, "video": vid_url, "tts": tts_url}, indent=1))
