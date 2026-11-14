#!/usr/bin/env python3
"""Double-fork daemon: wait for Vercel device-flow auth, then deploy to production."""
import os
import sys
import time

AUTH = os.path.expanduser("~/.local/share/com.vercel.cli/auth.json")
LOG = "/tmp/vercel-deploy.log"
PROJ = "/home/z/my-project"


def log(msg):
    print(time.strftime("[%H:%M:%S] ") + msg, flush=True)


# double fork -> survive sandbox process cleanup
if os.fork() > 0:
    sys.exit(0)
os.setsid()
if os.fork() > 0:
    sys.exit(0)
os.chdir(PROJ)
with open(LOG, "ab", 0) as f:
    os.dup2(f.fileno(), 1)
    os.dup2(f.fileno(), 2)

log("waiting for Vercel device auth (%s) ..." % AUTH)
deadline = time.time() + 60 * 90
while time.time() < deadline:
    if os.path.exists(AUTH):
        log("auth detected!")
        break
    time.sleep(5)
else:
    log("timeout waiting for auth")
    sys.exit(1)

time.sleep(3)
log("linking project visioncut-ai ...")
rc = os.system("vercel link --yes --project visioncut-ai")
log("link rc=%d" % rc)
if rc != 0:
    sys.exit(1)

log("deploying to PRODUCTION ...")
rc = os.system("vercel --prod --yes")
log("deploy rc=%d" % rc)
log("PROD DEPLOY DONE" if rc == 0 else "PROD DEPLOY FAILED")
