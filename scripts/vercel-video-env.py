#!/usr/bin/env python3
"""Manage VisionCut AI env vars on Vercel after the OpenRouter removal.

Modes:
  sync   - upsert VIDEO_PROVIDER / VIDEO_API_KEY (3 targets) and DELETE the
           OpenRouter-era vars (OPENROUTER_*, SCRIPT_PROVIDER) from the project.
  fetch  - restore the local .env from the deployed Vercel values
           (DATABASE_URL, DATABASE_URL_UNPOOLED, TRANSCRIBE_*).

Usage:
  VT=<vercel-token> python3 scripts/vercel-video-env.py sync <teamId> <projectId> <videoKey>
  VT=<vercel-token> python3 scripts/vercel-video-env.py fetch <teamId> <projectId>
"""
import json
import os
import secrets
import sys
import urllib.error
import urllib.request

ROOT = "/home/z/my-project"
API = "https://api.vercel.com"
DELETE_KEYS_PREFIXES = ("OPENROUTER_",)
DELETE_KEYS_EXACT = {"SCRIPT_PROVIDER"}
FETCH_KEYS = ("DATABASE_URL", "DATABASE_URL_UNPOOLED", "AUTH_SECRET",
              "TRANSCRIBE_PROVIDER", "TRANSCRIBE_API_KEY", "TRANSCRIBE_BASE_URL", "TRANSCRIBE_MODEL")


def req(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


def list_envs(token, team, project):
    st, body = req("GET", f"/v9/projects/{project}/env?teamId={team}", token)
    if st != 200:
        sys.exit(f"list envs failed: {st} {body}")
    return body.get("envs", [])


def upsert_env(token, team, project, key, value):
    st, body = req(
        "POST",
        f"/v10/projects/{project}/env?upsert=true&teamId={team}",
        token,
        {"key": key, "value": value, "type": "encrypted",
         "target": ["production", "preview", "development"]},
    )
    print(("OK   " if st in (200, 201) else "FAIL ") + f"upsert {key} -> {st} {str(body)[:160]}")


def delete_env(token, team, project, env_id, key):
    st, body = req("DELETE", f"/v9/projects/{project}/env/{env_id}?teamId={team}", token)
    print(("OK   " if st in (200, 204) else "FAIL ") + f"delete {key} -> {st}")


def get_env_value(token, team, project, env_id):
    st, body = req("GET", f"/v9/projects/{project}/env/{env_id}?teamId={team}", token)
    if st != 200:
        return None
    return body.get("value")


def main():
    mode = sys.argv[1]
    team, project = sys.argv[2], sys.argv[3]
    token = os.environ["VT"]

    envs = list_envs(token, team, project)

    if mode == "sync":
        video_key = sys.argv[4]
        upsert_env(token, team, project, "VIDEO_PROVIDER", "auto")
        upsert_env(token, team, project, "VIDEO_API_KEY", video_key)
        for e in envs:
            k = e.get("key", "")
            if k in DELETE_KEYS_EXACT or k.startswith(DELETE_KEYS_PREFIXES):
                delete_env(token, team, project, e["id"], k)
        # local parity
        env_path = os.path.join(ROOT, ".env")
        with open(env_path) as f:
            content = f.read()
        lines = []
        wanted = {"VIDEO_PROVIDER": "auto", "VIDEO_API_KEY": video_key}
        for k, v in wanted.items():
            if f"\n{k}=" not in content:
                lines.append(f'{k}="{v}"')
        if lines:
            with open(env_path, "a") as f:
                f.write("\n" + "\n".join(lines) + "\n")
            print("local .env: VIDEO_* appended")
        else:
            print("local .env: VIDEO_* already present")
        return

    if mode == "fetch":
        out = {}
        for e in envs:
            k = e.get("key", "")
            if k in FETCH_KEYS:
                val = e.get("value") or get_env_value(token, team, project, e["id"])
                if val:
                    out[k] = val
        missing = [k for k in ("DATABASE_URL", "DATABASE_URL_UNPOOLED") if not out.get(k)]
        if missing:
            sys.exit(f"could not recover {missing} from Vercel (masked?)")
        if "AUTH_SECRET" not in out:
            out["AUTH_SECRET"] = secrets.token_urlsafe(32)
            print("note: AUTH_SECRET not recoverable, generated a fresh local-only one")
        env_path = os.path.join(ROOT, ".env")
        with open(env_path) as f:
            existing = f.read()
        keep = [ln for ln in existing.splitlines() if ln.strip() and "=" in ln
                and ln.split("=", 1)[0].strip() not in out]
        with open(env_path, "w") as f:
            f.write("\n".join(keep + [f'{k}="{v}"' for k, v in out.items()]) + "\n")
        os.chmod(env_path, 0o600)
        print(f"local .env restored with {len(out)} vars from Vercel")
        return

    sys.exit(f"unknown mode {mode}")


if __name__ == "__main__":
    main()
