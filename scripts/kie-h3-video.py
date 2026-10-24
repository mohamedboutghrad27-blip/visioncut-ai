#!/usr/bin/env python3
"""Submit MiniMax H3 t2v via Kie with the full documented schema, poll to MP4."""
import json
import time
import urllib.parse
import urllib.request

KEY = "af5e7acdb9f867708283ad4438f8f86a"
BASE = "https://api.kie.ai/api/v1/jobs"

def post(payload):
    req = urllib.request.Request(f"{BASE}/createTask", data=json.dumps(payload).encode(),
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode() or "{}")

def credit():
    req = urllib.request.Request("https://api.kie.ai/api/v1/chat/credit", headers={"Authorization": f"Bearer {KEY}"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read().decode()).get("data")

body = {"model": "minimax-h3/text-to-video",
        "input": {"prompt": "A drone shot flying slowly over a desert oasis at sunset, palm trees reflecting in turquoise water, cinematic, smooth camera motion",
                  "aspect_ratio": "16:9",
                  "duration": 5}}
r = post(body)
print("createTask:", json.dumps(r)[:220])
tid = (r.get("data") or {}).get("taskId")
if not tid:
    # retry with 6s (docs example duration)
    body["input"]["duration"] = 6
    r = post(body)
    print("retry(6s):", json.dumps(r)[:220])
    tid = (r.get("data") or {}).get("taskId")
if not tid:
    raise SystemExit("could not create task")

print("taskId:", tid, "| credits after submit:", credit())
t0 = time.time()
while time.time() - t0 < 480:
    req = urllib.request.Request(f"{BASE}/recordInfo?taskId={urllib.parse.quote(tid)}", headers={"Authorization": f"Bearer {KEY}"})
    d = (json.loads(urllib.request.urlopen(req, timeout=45).read().decode()).get("data") or {})
    st = d.get("state")
    if st == "success":
        urls = (json.loads(d.get("resultJson") or "{}")).get("resultUrls") or []
        print("SUCCESS:", urls[0] if urls else "(no url)")
        break
    if st == "fail":
        print("FAIL:", d.get("failMsg"))
        break
    print(f"  {st} ({int(time.time()-t0)}s)")
    time.sleep(20)
print("credits final:", credit())
