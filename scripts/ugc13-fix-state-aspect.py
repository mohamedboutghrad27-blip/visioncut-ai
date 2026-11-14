#!/usr/bin/env python3
"""Fix the live Claude UGC Ads project editor-state aspect ratio.
The project was created via MCP BEFORE the Task-27 fix deployed, so its
state JSON still says aspectRatio=16:9 while the ad is vertical 9:16.
Logs in as the demo account (same owner MCP uses) and PATCHes the state.
"""
import json
import urllib.request

BASE = "https://visioncut-ai-mu.vercel.app"
PROJECT_ID = "cmvn0bfh20001l7084wurz2b2"
EMAIL = "demo@visioncut.ai"
PASSWORD = "visioncut-demo-2026"

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())

def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with opener.open(req, timeout=60) as r:
        body = r.read().decode()
    return json.loads(body) if body else {}

login = call("POST", "/api/auth/demo", {"email": EMAIL, "password": PASSWORD})
print("login:", "ok" if login.get("user") else login)

proj = call("GET", f"/api/projects/{PROJECT_ID}")["project"]
state = json.loads(proj["data"])
print("DB aspectRatio:", proj["aspectRatio"], "| state.aspectRatio:", state.get("aspectRatio"))

if state.get("aspectRatio") == proj["aspectRatio"]:
    print("state already matches — nothing to do")
else:
    state["aspectRatio"] = proj["aspectRatio"]
    res = call("PATCH", f"/api/projects/{PROJECT_ID}", {"data": json.dumps(state)})
    print("patch:", res)
    check = json.loads(call("GET", f"/api/projects/{PROJECT_ID}")["project"]["data"])
    print("after fix, state.aspectRatio:", check.get("aspectRatio"))
