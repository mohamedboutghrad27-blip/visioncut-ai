#!/bin/bash
# Publishes VisionCut AI to GitHub as a clean single-commit repo.
# Idempotent: recreates the orphan commit if the sandbox reset branches.
set -e
cd /home/z/my-project
export GH_T="${GH_T:?set GH_T env var}"
USER_GH='mohamedboutghrad27-blip'
REPO='visioncut-ai'

# 1. Ensure publish-clean exists with the clean commit
if ! git rev-parse -q --verify publish-clean >/dev/null 2>&1; then
  echo "[publish] branch lost — recreating"
  git checkout -q --orphan publish-clean
  git rm -rf --cached -q . 2>/dev/null || true
  git add .gitignore README.md .env.example package.json bun.lock tsconfig.json \
          next.config.ts tailwind.config.ts postcss.config.mjs eslint.config.mjs \
          components.json neon.ts prisma/schema.prisma public src \
          scripts/dump-sqlite.ts scripts/e2e-neon-test.ts scripts/neon-login-retry.sh \
          scripts/seed-neon.ts scripts/with-neon-env.sh
  git commit -q -m "VisionCut AI — initial release

Professional AI-powered video editing platform:
- Multi-track editor (timeline, canvas compositor, properties, undo/redo)
- Real export pipeline (resolution/fps/aspect/quality, verified downloads)
- AI tools: storyboard, text-to-video, subtitles, voiceover
- Auth + dashboard + projects CRUD
- Neon Lakebase Postgres via Prisma (pooled + direct connections)"
fi

# 2. Leak check on the commit tree
if git ls-tree -r --name-only publish-clean | rg -q -i "^\.env$|custom\.db|sqlite-dump|\.log$|worklog|tool-results|shot-"; then
  echo "!!! LEAK in commit tree — ABORT"; exit 1
fi
echo "[publish] leak check clean ✓ ($(git ls-tree -r --name-only publish-clean | wc -l) files)"

# 3. Push publish-clean to remote main (token inline, never stored)
git push -q "https://${USER_GH}:${GH_T}@github.com/${USER_GH}/${REPO}.git" +publish-clean:main 2>&1 | tail -1 || true
echo "[publish] pushed publish-clean → ${USER_GH}/${REPO}:main"

# 4. Restore sandbox-favored local state
git checkout -q main 2>/dev/null || true
git branch -D publish-clean >/dev/null 2>&1 || true

# 5. Set clean remote (no token)
git remote remove origin >/dev/null 2>&1 || true
git remote add origin "https://github.com/${USER_GH}/${REPO}.git"
echo "[publish] remote origin set (token-free)"
