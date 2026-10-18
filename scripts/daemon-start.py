#!/usr/bin/env python3
"""Double-fork daemon starter: survives sandbox tool-call recycling.

Detaches npm run start (Next.js standalone server) from the calling shell
by double-forking; the grandchild is reparented to PID 1 and survives.
"""
import os
import sys

PID = os.fork()
if PID > 0:
    sys.exit(0)  # parent exits

os.setsid()  # new session, detach from controlling terminal

PID = os.fork()  # second fork: never session leader again
if PID > 0:
    sys.exit(0)

os.chdir("/home/z/my-project")

with open("server.log", "ab") as out:  # append server output
    os.dup2(out.fileno(), 1)
    os.dup2(out.fileno(), 2)

os.execvp("npm", ["npm", "run", "start"])
