/**
 * Local E2E check of the WaveSpeed video provider path in src/lib/video.ts.
 * Run: npx tsx scripts/test-video-wavespeed.ts
 * (no server needed — calls the lib directly; costs $0.01 per run)
 */
import { submitVideoGeneration, pollVideoGeneration, videoDiagnostics, VideoPollResult } from "../src/lib/video";

if (!process.env.WAVESPEED_API_KEY) {
  // key lives in .env — keep it out of git
  console.error("Set WAVESPEED_API_KEY (e.g. `set -a; source .env; set +a` before running).");
  process.exit(1);
}
process.env.VIDEO_PROVIDER = process.env.VIDEO_PROVIDER || "wavespeed"; // pinned: errors surface as-is

async function main() {
  console.log("diagnostics:", JSON.stringify(videoDiagnostics(), null, 2));

  const res = await submitVideoGeneration({
    prompt: "a cinematic drone shot over a turquoise ocean coastline at golden hour",
    duration: 5,
    withAudio: false,
    fps: 30,
    quality: "speed",
  });
  console.log("SUBMIT OK:", res);

  const deadline = Date.now() + 5 * 60_000; // 5 min cap
  let final: VideoPollResult | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));
    const st = await pollVideoGeneration(res.taskId);
    console.log(`POLL ${new Date().toISOString().slice(11, 19)}:`, st);
    if (st.status === "SUCCESS" || st.status === "FAILED") {
      final = st;
      break;
    }
  }
  if (final?.status === "SUCCESS" && final.videoUrl) {
    // download the mp4 to prove it is a real playable file
    const buf = Buffer.from(await (await fetch(final.videoUrl)).arrayBuffer());
    const out = "/home/z/my-project/scripts/ws-test-output.mp4";
    (await import("fs")).writeFileSync(out, buf);
    console.log(`DOWNLOADED: ${out} (${buf.length} bytes)`);
    console.log("PASS");
  } else {
    console.log("FAIL:", final);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERROR:", e?.name, e?.message, e?.status ? `(status ${e.status})` : "");
  process.exit(1);
});
