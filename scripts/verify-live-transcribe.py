#!/usr/bin/env python3
"""Verify transcription subsystem on a live deployment (no third-party calls).

Expected live state (provider not yet named): diagnostics show hasApiKey=true,
POST returns 503 with the 'No transcription provider available' guidance.
"""
import base64
import json
import math
import struct
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://visioncut-ai-mu.vercel.app"


def make_sine_wav(seconds=1, freq=440, rate=16000) -> str:
    n = seconds * rate
    hdr = b"RIFF" + struct.pack("<I", 36 + n * 2) + b"WAVEfmt " + struct.pack(
        "<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16
    ) + b"data" + struct.pack("<I", n * 2)
    samples = b"".join(
        struct.pack("<h", int(math.sin(2 * math.pi * freq * i / rate) * 12000)) for i in range(n)
    )
    return base64.b64encode(hdr + samples).decode()


def req(path, method="GET", payload=None, cookie=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        r.add_header("Content-Type", "application/json")
    if cookie:
        r.add_header("Cookie", cookie)
    resp = urllib.request.urlopen(r)
    return resp, resp.read().decode()


# 1. landing
import urllib.error

try:
    resp, _ = req("/")
    print(f"landing: HTTP {resp.status}")
except urllib.error.HTTPError as e:
    print(f"landing: HTTP {e.code}")

# 2. demo login
resp, body = req("/api/auth/demo", method="POST")
set_cookie = resp.headers.get("Set-Cookie", "")
cookie = set_cookie.split(";")[0]
print(f"demo login: HTTP {resp.status} cookie={'yes' if cookie else 'NO'}")

# 3. diagnostics
resp, body = req("/api/ai/subtitles", cookie=cookie)
print(f"diagnostics: HTTP {resp.status} {body[:200]}")

# 4. transcription attempt (expected 503 until provider is named)
try:
    resp, body = req(
        "/api/ai/subtitles",
        method="POST",
        payload={"audioBase64": make_sine_wav(), "duration": 1},
        cookie=cookie,
    )
    print(f"transcribe: HTTP {resp.status} {body[:300]}")
    ok = False  # unexpected success with no provider configured
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"transcribe: HTTP {e.code} {body[:300]}")
    ok = e.code == 503 and "No transcription provider" in body

print("VERIFY_PASS" if ok else "VERIFY_FAIL")
sys.exit(0 if ok else 1)
