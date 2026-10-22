#!/usr/bin/env python3
"""Build a compact OpenMoji search index from the official openmoji.json.
Source: https://github.com/hfg-gmuend/openmoji (CC BY-SA 4.0)
Output: src/data/openmoji-index.json  (~each entry: emoji, hexcode, annotation, tags, group)
"""
import json, urllib.request, os

SRC = "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@latest/data/openmoji.json"
OUT = "/home/z/my-project/src/data/openmoji-index.json"

req = urllib.request.Request(SRC, headers={"User-Agent": "visioncut/1.0"})
data = json.load(urllib.request.urlopen(req, timeout=60))
print("fetched entries:", len(data))

index = []
for e in data:
    hexcode = (e.get("hexcode") or "").strip()
    if not hexcode:
        continue
    # skip skin-tone variants to keep the grid clean (base emoji only)
    if "-" in hexcode:
        continue
    index.append({
        "e": e.get("emoji", ""),
        "h": hexcode,
        "a": (e.get("annotation") or "").lower(),
        "t": (e.get("tags") or "").lower(),
        "g": e.get("group") or "",
    })

print("base entries (no skin variants):", len(index))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
