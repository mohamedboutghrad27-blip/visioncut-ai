/**
 * Standalone E2E for the text-to-video core (src/lib/video.ts) — no DB, no HTTP.
 * Pins VIDEO_PROVIDER=zai so the sandbox platform SDK path is exercised directly.
 */
import { submitVideoGeneration, pollVideoGeneration, VideoError } from "../src/lib/video";

async function main() {
  process.env.VIDEO_PROVIDER = "zai"; // pin: skip external providers in auto chain
  const prompt = "A slow cinematic drone shot over a neon-lit cyberpunk city at night, rain, reflections";
  console.log("[test] submitting text-to-video task (zai provider)...");
  try {
    const submitted = await submitVideoGeneration({
      prompt,
      duration: 5,
      withAudio: false,
      fps: 30,
      quality: "speed",
    });
    console.log(`[test] taskId=${submitted.taskId} provider=${submitted.provider} model=${submitted.model}`);

    const max = 90; // 90 * 5s = 7.5 min
    for (let i = 1; i <= max; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await pollVideoGeneration(submitted.taskId);
      console.log(`[test] poll ${i}/${max}: ${res.status}${res.videoUrl ? " url=" + res.videoUrl.slice(0, 80) + "..." : ""}`);
      if (res.status === "SUCCESS") {
        if (!res.videoUrl) throw new Error("SUCCESS without videoUrl");
        console.log("[test] PASS — video generated:", res.videoUrl);
        return;
      }
      if (res.status === "FAILED") throw new Error(res.error || "task failed");
    }
    throw new Error("timed out waiting for the video");
  } catch (err) {
    if (err instanceof VideoError) {
      console.error(`[test] FAIL VideoError(${err.provider}, ${err.status}): ${err.message}`);
    } else {
      console.error("[test] FAIL", err);
    }
    process.exit(1);
  }
}

main();
