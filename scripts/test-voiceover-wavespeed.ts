/**
 * Local E2E for the WaveSpeed voiceover engine (env-driven — no key in git).
 * Calls generateVoiceover() directly (fast + hd + arabic + fallback path).
 * Run: set -a; source .env; set +a; npx tsx scripts/test-voiceover-wavespeed.ts
 */
import { writeFileSync } from "node:fs";
import { generateVoiceover, voiceoverDiagnostics } from "../src/lib/voiceover";

async function main() {
  console.log("diagnostics:", JSON.stringify(voiceoverDiagnostics(), null, 1));

  // 1) Arabic text, fast tier (omnivoice), female voice
  const t0 = Date.now();
  const ar = await generateVoiceover({
    text: "مرحبا بكم في فيجن كت، محرر الفيديو بالذكاء الاصطناعي. أنشئ فيديوك في دقائق.",
    voice: "female",
    speed: 1,
    quality: "fast",
  });
  const arBytes = Math.floor((ar.audioDataUrl.split(",")[1]?.length || 0) * 0.75);
  console.log(`[fast/arabic/female] provider=${ar.provider} model=${ar.model} bytes=${arBytes} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (ar.provider !== "wavespeed") throw new Error("expected wavespeed provider");
  if (arBytes < 512) throw new Error("audio too small");
  writeFileSync("/home/z/my-project/scripts/tts-fast-ar.mp3", Buffer.from(ar.audioDataUrl.split(",")[1], "base64"));

  // 2) English text, male voice
  const t1 = Date.now();
  const en = await generateVoiceover({
    text: "Welcome to VisionCut AI. Edit videos with the power of artificial intelligence.",
    voice: "male",
    speed: 1.1,
    quality: "fast",
  });
  const enBytes = Math.floor((en.audioDataUrl.split(",")[1]?.length || 0) * 0.75);
  console.log(`[fast/english/male] provider=${en.provider} model=${en.model} bytes=${enBytes} in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  if (enBytes < 512) throw new Error("audio too small");
  writeFileSync("/home/z/my-project/scripts/tts-fast-en.mp3", Buffer.from(en.audioDataUrl.split(",")[1], "base64"));

  // 3) HD tier (minimax) with Arabic -> language_boost:Arabic
  const t2 = Date.now();
  const hd = await generateVoiceover({
    text: "في هذا الفيديو سنتعلم كيف نحرر الفيديو بسرعة واحترافية.",
    voice: "male",
    quality: "hd",
  });
  const hdBytes = Math.floor((hd.audioDataUrl.split(",")[1]?.length || 0) * 0.75);
  console.log(`[hd/arabic] provider=${hd.provider} model=${hd.model} bytes=${hdBytes} in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
  if (hdBytes < 512) throw new Error("audio too small");
  writeFileSync("/home/z/my-project/scripts/tts-hd-ar.mp3", Buffer.from(hd.audioDataUrl.split(",")[1], "base64"));

  console.log("ALL VOICEOVER TESTS PASSED");
}

main().catch((err) => {
  console.error("VOICEOVER TEST FAILED:", err?.message || err);
  process.exit(1);
});
