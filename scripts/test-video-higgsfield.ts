/**
 * Local E2E check of the Higgsfield video provider path in src/lib/video.ts.
 * Run: npx tsx scripts/test-video-higgsfield.ts
 * (no server needed — calls the lib directly)
 */
import { submitVideoGeneration, pollVideoGeneration, VideoError, videoDiagnostics } from "../src/lib/video";

const KEY = "bc0ae1bc-7f59-499c-a6f4-b63c5d1bb4bd:a16b6163f0d39f5e06e0ce510a456883891640db350d92beae200f246e00664b";
process.env.VIDEO_API_KEY = KEY;
process.env.VIDEO_PROVIDER = "higgsfield"; // pinned: error must surface as-is

async function main() {
  console.log("diagnostics:", JSON.stringify(videoDiagnostics(), null, 2));

  try {
    const res = await submitVideoGeneration({
      prompt: "a cinematic drone shot over a turquoise ocean coastline at golden hour",
      duration: 5,
      withAudio: false,
      fps: 30,
      quality: "speed",
    });
    console.log("SUBMIT OK:", res);
    // poll a couple of times just to exercise the status endpoint
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      const st = await pollVideoGeneration(res.taskId);
      console.log(`POLL ${i + 1}:`, st);
      if (st.status === "SUCCESS" || st.status === "FAILED") break;
    }
    console.log("RESULT: PASS (task accepted — credits available)");
  } catch (err) {
    if (err instanceof VideoError) {
      console.log(`EXPECTED VideoError provider=${err.provider} status=${err.status}`);
      console.log("message:", err.message);
      if (/out of credits/.test(err.message) && err.status === 402) {
        console.log("RESULT: PASS (key authenticated; not_enough_credits correctly mapped)");
        return;
      }
      console.log("RESULT: FAIL (unexpected error shape)");
      process.exit(1);
    }
    throw err;
  }
}

main().catch((e) => {
  console.error("UNEXPECTED:", e);
  process.exit(1);
});
