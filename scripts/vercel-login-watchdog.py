#!/usr/bin/env python3
"""Watchdog: keep `vercel login` alive until auth.json appears.
If the login process dies (device code expired, ~10 min), restart it and
log the fresh device code. Complements vercel-deploy-watcher.py which
performs the actual production deploy once auth lands."""
import os
import subprocess
import sys
import time

AUTH = os.path.expanduser("~/.local/share/com.vercel.cli/auth.json")
LOGIN_LOG = "/tmp/vercel-login.log"
WATCH_LOG = "/tmp/vercel-watchdog.log"
VERCEL = "/home/z/my-project/.tools/node_modules/.bin/vercel"


def log(msg):
    line = time.strftime("[%H:%M:%S] ") + msg
    with open(WATCH_LOG, "a") as f:
        f.write(line + "\n")


def login_pid_alive():
    # The CLI binary lives at .tools/node_modules/@vercel/vc-native-linux-x64/bin/vercel
    out = subprocess.run(["pgrep", "-f", r"vc-native-linux-x64/bin/vercel\s+login"],
                         capture_output=True, text=True)
    return out.returncode == 0


def spawn_login():
    if os.fork() > 0:
        return
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    devnull = os.open(os.devnull, os.O_RDWR)
    logf = os.open(LOGIN_LOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC)
    os.dup2(logf, 1)
    os.dup2(logf, 2)
    os.dup2(devnull, 0)
    os.execvp(VERCEL, [VERCEL, "login"])


log("watchdog started")
deadline = time.time() + 60 * 120
while time.time() < deadline:
    if os.path.exists(AUTH):
        log("auth.json present - login complete, watchdog exiting")
        sys.exit(0)
    if not login_pid_alive():
        log("vercel login process dead (code expired?) - restarting")
        spawn_login()
        time.sleep(8)
        with open(LOGIN_LOG) as f:
            for ln in f:
                if "user_code=" in ln:
                    log("NEW DEVICE CODE -> " + ln.strip())
                    break
    time.sleep(10)
log("watchdog timeout")
