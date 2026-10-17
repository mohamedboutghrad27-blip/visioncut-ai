#!/bin/bash
# Retries `neon login` in the background while the main agent does non-auth work.
# Writes the current Auth URL to /tmp/neon-login-latest.txt for the user to open.
# Stops as soon as authentication succeeds.
LOG=/tmp/neon-login-retry.log
URLFILE=/tmp/neon-login-latest.txt
: > "$LOG"
echo "login-retry loop started $(date)" >> "$LOG"
for i in $(seq 1 10); do
  echo "attempt $i $(date)" >> "$LOG"
  # Run login; print its output into the log; the CLI itself times out after 60s
  timeout 75 neon login >> "$LOG" 2>&1
  # Keep the most recent Auth Url available for the user
  rg "^Auth Url:" "$LOG" | tail -1 > "$URLFILE" || true
  if neon profile list -o json 2>/dev/null | rg -q '"account": "(?!-)' ; then
    echo "SUCCESS $(date)" > "$URLFILE"
    echo "SUCCESS $(date)" >> "$LOG"
    exit 0
  fi
  sleep 5
done
echo "EXHAUSTED $(date)" > "$URLFILE"
echo "EXHAUSTED $(date)" >> "$LOG"
