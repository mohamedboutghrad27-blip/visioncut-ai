#!/usr/bin/env bash
# Probe a user-provided API key against common speech-to-text / LLM providers
# (auth-only, read-only endpoints). Prints HTTP status + sanitized snippet.
KEY="${PROBE_KEY:?set PROBE_KEY}"
UA="visioncut-probe/1.0"

probe() {
  local name="$1"; shift
  local out code body
  out=$(curl -sS -m 15 -A "$UA" -w $'\n%{http_code}' "$@" 2>/dev/null)
  code=$(printf '%s' "$out" | tail -n1)
  body=$(printf '%s' "$out" | head -n -1 | tr -d '\n' | cut -c1-180)
  # sanitize: never print anything that looks like a token (long base64/hex runs)
  body=$(printf '%s' "$body" | sed -E 's/[A-Za-z0-9_\-]{25,}/[MASKED]/g')
  printf '%-16s HTTP %s  %s\n' "$name" "${code:-ERR}" "$body"
}

echo "=== Probing key (providers: STT + LLM platforms) ==="

# IBM Cloud IAM (Watson Speech-to-Text keys are IBM Cloud API keys)
probe "IBM-Watson" -X POST "https://iam.cloud.ibm.com/identity/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=urn:ibm:params:oauth:grant-type:apikey" \
  --data-urlencode "apikey=$KEY"

# Deepgram (STT)
probe "Deepgram" "https://api.deepgram.com/v1/projects" -H "Authorization: Token $KEY"

# AssemblyAI (STT)
probe "AssemblyAI" "https://api.assemblyai.com/v2/transcripts?limit=1" -H "Authorization: $KEY"

# Speechmatics (STT) - key->JWT exchange
probe "Speechmatics" -X POST "https://asr.api.speechmatics.com/v2/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"auth_type\":\"api_key\",\"api_key\":\"$KEY\"}"

# Rev AI (STT)
probe "RevAI" "https://api.rev.ai/speechtotext/v1/account" -H "Authorization: Bearer $KEY"

# ElevenLabs (Scribe STT)
probe "ElevenLabs" "https://api.elevenlabs.io/v1/user" -H "xi-api-key: $KEY"

# Groq (whisper/large-v3 STT host)
probe "Groq" "https://api.groq.com/openai/v1/models" -H "Authorization: Bearer $KEY"

# OpenAI (whisper/gpt-4o-transcribe host)
probe "OpenAI" "https://api.openai.com/v1/models" -H "Authorization: Bearer $KEY"

# Gladia (STT)
probe "Gladia" "https://api.gladia.io/v2/transcription?limit=1" -H "x-gladia-key: $KEY"

# Z.ai open platform (GLM) - free glm-4.5-flash model, minimal request
probe "Z.ai" -X POST "https://api.z.ai/api/paas/v4/chat/completions" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"glm-4.5-flash","messages":[{"role":"user","content":"hi"}],"max_tokens":1}'

# Zhipu bigmodel.cn (GLM China endpoint)
probe "BigModel" -X POST "https://open.bigmodel.cn/api/paas/v4/chat/completions" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"glm-4.5-flash","messages":[{"role":"user","content":"hi"}],"max_tokens":1}'

echo "=== done ==="
