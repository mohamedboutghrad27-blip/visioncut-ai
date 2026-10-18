#!/usr/bin/env bash
# Probe the user-provided video-generation API key against known video AI providers.
# Auth-only / read-only probes. Prints HTTP status + sanitized body snippet.
KEY="${PROBE_KEY:?set PROBE_KEY}"
UA="visioncut-probe/1.0"
B64=$(printf '%s' "$KEY" | base64 -w0)

probe() {
  local name="$1"; shift
  local out code body
  out=$(curl -sS -m 20 -A "$UA" -w $'\n%{http_code}' "$@" 2>/dev/null)
  code=$(printf '%s' "$out" | tail -n1)
  body=$(printf '%s' "$out" | head -n -1 | tr -d '\n' | cut -c1-160)
  body=$(printf '%s' "$body" | sed -E 's/[A-Za-z0-9_\-\.]{25,}/[MASKED]/g')
  printf '%-14s HTTP %-4s %s\n' "$name" "${code:-ERR}" "$body"
}

echo "=== probing video-gen providers (uuid:hex64 key) ==="

# fal.ai — sync endpoint, Bearer variant (Key variant already 401)
probe "fal-Bearer" -X POST "https://fal.run/fal-ai/wan-t2v" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{}'

# PixVerse platform — API-KEY header
probe "PixVerse" -X POST "https://app-api.pixverse.ai/openapi/v2/video/text/generate" \
  -H "API-KEY: $KEY" -H "Ai-Trace-Id: visioncut-probe" -H "Content-Type: application/json" -d '{}'

# Vidu — Token scheme
probe "Vidu" -X POST "https://api.vidu.com/ent/v2/text2video" \
  -H "Authorization: Token $KEY" -H "Content-Type: application/json" -d '{}'

# Kie.ai — Bearer, common job create endpoint
probe "Kie.ai" -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{}'

# Creatify — Basic base64(id:secret)
probe "Creatify" "https://api.creatify.ai/api/my-information/" \
  -H "Authorization: Basic $B64"

# D-ID — Basic base64(id:secret)
probe "D-ID" "https://api.d-id.com/credits" \
  -H "Authorization: Basic $B64"

# HeyGen — Bearer
probe "HeyGen" "https://api.heygen.com/v2/user/remaining_quota" \
  -H "X-Api-Key: $KEY"

# Tavus — Bearer
probe "Tavus" "https://tavusapi.com/v2/personas" \
  -H "x-api-key: $KEY"

# Runway — Bearer + version header
probe "Runway" "https://api.dev.runwayml.com/v1/organization" \
  -H "Authorization: Bearer $KEY" -H "X-Runway-Version: 2024-11-06"

# AI/ML API — Bearer
probe "AIMLAPI" "https://api.aimlapi.com/v1/models" \
  -H "Authorization: Bearer $KEY"

# DeepInfra — Bearer
probe "DeepInfra" "https://api.deepinfra.com/v1/openai/models" \
  -H "Authorization: Bearer $KEY"

# Leonardo — Bearer
probe "Leonardo" "https://cloud.leonardo.ai/api/rest/v1/me" \
  -H "Authorization: Bearer $KEY"

# Runware — Bearer
probe "Runware" -X POST "https://api.runware.ai/v1" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '[]'

# Replicate — Bearer
probe "Replicate" "https://api.replicate.com/v1/account" \
  -H "Authorization: Bearer $KEY"

# Stability — Bearer
probe "Stability" "https://api.stability.ai/v1/user/account" \
  -H "Authorization: Bearer $KEY"

# Luma Dream Machine — Bearer
probe "Luma" "https://api.lumalabs.ai/dream-machine/v1/generations?limit=1" \
  -H "Authorization: Bearer $KEY"

# Synthesia — Bearer
probe "Synthesia" "https://api.synthesia.io/v2/videos?limit=1" \
  -H "Authorization: $KEY"

echo "=== done ==="
