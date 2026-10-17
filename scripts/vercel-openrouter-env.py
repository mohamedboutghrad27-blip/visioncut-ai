#!/usr/bin/env python3
"""Add OpenRouter LLM vars (OPENROUTER_*, SCRIPT_PROVIDER) to the Vercel project.

Usage: VT=<vercel-token> python3 scripts/vercel-openrouter-env.py
Env vars are upserted for production+preview+development.
"""
import json
import os
import sys
import urllib.request

TEAM = "team_19JGvgtD1TxXG8npqmxVwFMB"
PROJECT = "prj_VjzQ8ILqlHGdbrXYFM5nXY33HWkI"
TOKEN = os.environ.get("VT")
if not TOKEN:
    sys.exit("set VT=<vercel-token>")

PREFIXES = ("OPENROUTER_", "SCRIPT_PROVIDER")

# Parse relevant vars from local .env (comments and blanks skipped)
env_vars = {}
with open(".env") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            if k.startswith(PREFIXES) and v.strip():
                env_vars[k] = v.strip().strip('"').strip("'")

if "OPENROUTER_API_KEY" not in env_vars:
    sys.exit("OPENROUTER_API_KEY missing in .env")

targets = ["production", "preview", "development"]
for key, value in env_vars.items():
    payload = json.dumps({"key": key, "value": value, "type": "encrypted", "target": targets}).encode()
    req = urllib.request.Request(
        f"https://api.vercel.com/v10/projects/{PROJECT}/env?upsert=true&teamId={TEAM}",
        data=payload,
        method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        body = json.loads(res.read().decode())
        created = body.get("created") or body.get("upserted") or []
        if isinstance(created, list) and created and isinstance(created[0], dict):
            created = [e.get("key") for e in created]
        print(f"{key}: HTTP {res.status} -> {created}")
print("done")
