#!/usr/bin/env python3
"""Double-fork vercel login so the device-flow poller survives sandbox
tool-call recycling (same pattern as daemon-start.py)."""
import os, sys

PID = os.fork()
if PID > 0:
    sys.exit(0)
os.setsid()
PID = os.fork()
if PID > 0:
    sys.exit(0)
os.chdir("/home/z/my-project")
devnull = os.open(os.devnull, os.O_RDWR)
log = os.open("/tmp/vercel-login.log", os.O_WRONLY | os.O_CREAT | os.O_TRUNC)
os.dup2(log, 1)
os.dup2(log, 2)
os.dup2(devnull, 0)
os.execvp("vercel", ["vercel", "login"])
