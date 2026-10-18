#!/usr/bin/env python3
"""Set VisionCut AI env vars on Vercel project (idempotent via upsert).

Reads Neon URLs from .env, generates a fresh AUTH_SECRET,
POSTs each var to /v10/projects/{id}/env for production+preview+development.

Usage: VT=<token> python3 scripts/vercel-env.py <teamId> <projectId>
"""
import json
import os
import secrets
import sys
import urllib.error
import urllib.request

ROOT = "/home/z/my-project"


def parse_env(path):
    vals = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def main():
    team_id, project_id = sys.argv[1], sys.argv[2]
    token = os.environ["VT"]
    env = parse_env(os.path.join(ROOT, ".env"))

    missing = [k for k in ("DATABASE_URL", "DATABASE_URL_UNPOOLED") if not env.get(k)]
    if missing:
        print(f"ABORT: .env missing {missing}")
        sys.exit(1)

    auth_secret = secrets.token_urlsafe(32)
    targets = ["production", "preview", "development"]
    items = [
        {"key": "DATABASE_URL", "value": env["DATABASE_URL"], "type": "encrypted", "target": targets},
        {"key": "DATABASE_URL_UNPOOLED", "value": env["DATABASE_URL_UNPOOLED"], "type": "encrypted", "target": targets},
        {"key": "AUTH_SECRET", "value": auth_secret, "type": "encrypted", "target": targets},
    ]

    base = f"https://api.vercel.com/v10/projects/{project_id}/env?upsert=true&teamId={team_id}"
    failed = False
    for item in items:
        req = urllib.request.Request(
            base,
            data=json.dumps(item).encode(),
            method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        key = item["key"]
        try:
            with urllib.request.urlopen(req) as r:
                body = json.load(r)
                created = sorted((body.get("created") or {}).keys())
                print(f"OK   {key} -> targets={created or 'set'}")
        except urllib.error.HTTPError as e:
            print(f"FAIL {key} -> {e.code} {e.read().decode()[:300]}")
            failed = True

    # keep local parity: persist the same AUTH_SECRET locally (chmod 600 enforced by caller)
    env_path = os.path.join(ROOT, ".env")
    with open(env_path) as f:
        content = f.read()
    if "AUTH_SECRET" not in content:
        with open(env_path, "a") as f:
            f.write(f'AUTH_SECRET="{auth_secret}"\n')
        print("local .env: AUTH_SECRET appended")
    else:
        print("local .env: AUTH_SECRET already present")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
