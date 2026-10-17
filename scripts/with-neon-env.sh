#!/bin/bash
# Loads Neon env vars from .env with priority over any pre-set sandbox defaults,
# then execs the given command. Usage: scripts/with-neon-env.sh <cmd> [args...]
set -a
unset DATABASE_URL DATABASE_URL_UNPOOLED NEON_BRANCH
source /home/z/my-project/.env
set +a
exec "$@"
