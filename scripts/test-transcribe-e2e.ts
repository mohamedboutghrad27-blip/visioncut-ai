/**
 * E2E test for /api/ai/subtitles (transcription core).
 *
 *   mode=mock : expects the app to be started with TRANSCRIBE_PROVIDER=custom
 *               and TRANSCRIBE_BASE_URL=http://127.0.0.1:4545/v1 (mock server)
 *   mode=real : exercises the auto/zai path with a REAL TTS->ASR round trip
 *
 * Usage: BASE_URL=http://127.0.0.1:3000 MODE=mock npx tsx scripts/test-transcribe-e2e.ts
 */
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const MODE = process.env.MODE || "mock";

function makeSineWav(seconds = 1, freq = 440, rate = 16000): string {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000);
    buf.writeInt16LE(s, 44 + i * 2);
  }
  return buf.toString("base64");
}

function cookieFrom(res: Response): string {
  const anyRes = res as unknown as { headers: { getSetCookie?: () => string[] } };
  const list = anyRes.headers.getSetCookie ? anyRes.headers.getSetCookie() : [];
  const cookie = (list[0] || res.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) throw new Error("No session cookie returned by /api/auth/demo");
  return cookie;
}

async function main() {
  console.log(`[e2e] BASE=${BASE} MODE=${MODE}`);

  // 1. demo login -> session cookie
  const login = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  if (!login.ok) throw new Error(`demo login failed: HTTP ${login.status}`);
  const cookie = cookieFrom(login);
  console.log("[e2e] demo login OK");

  // 2. diagnostics
  const diag = await fetch(`${BASE}/api/ai/subtitles`, { headers: { cookie } });
  const diagBody = await diag.json();
  console.log(`[e2e] diagnostics HTTP ${diag.status}:`, JSON.stringify(diagBody.status || diagBody));

  // 3. audio payload
  let audioBase64: string;
  let duration = 1;
  if (MODE === "real") {
    const tts = await fetch(`${BASE}/api/ai/voiceover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ text: "VisionCut AI can now transcribe your videos automatically with any speech to text provider." }),
    });
    if (!tts.ok) throw new Error(`voiceover failed: HTTP ${tts.status} ${await tts.text()}`);
    const ttsBody = (await tts.json()) as { audioDataUrl: string; bytes: number };
    audioBase64 = ttsBody.audioDataUrl.split(",")[1];
    duration = Math.max(1, Math.round(ttsBody.bytes / (16000 * 2))); // rough 16k mono estimate
    console.log(`[e2e] TTS audio ${ttsBody.bytes} bytes`);
  } else {
    audioBase64 = makeSineWav();
    console.log("[e2e] using synthetic sine WAV");
  }

  // 4. transcribe
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/ai/subtitles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ audioBase64, duration }),
  });
  const body = (await res.json()) as { error?: string; text?: string; provider?: string; captions?: unknown[] };
  const ms = Date.now() - t0;
  console.log(`[e2e] subtitles HTTP ${res.status} in ${ms}ms provider=${body.provider}`);
  if (!res.ok) throw new Error(`transcription failed: ${body.error}`);
  console.log(`[e2e] transcript (${body.captions?.length} captions): ${body.text?.slice(0, 160)}`);

  if (MODE === "mock") {
    if (body.provider !== "custom") throw new Error(`expected provider=custom, got ${body.provider}`);
    if (!body.text?.includes("mock transcript")) throw new Error("unexpected mock transcript");
  } else {
    if (!body.text || body.text.length < 10) throw new Error("suspiciously short real transcript");
  }
  console.log("[e2e] PASS");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`[e2e] FAIL: ${e.message}`);
    process.exit(1);
  },
);
