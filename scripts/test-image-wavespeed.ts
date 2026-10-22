/**
 * Local E2E check of the text-to-image path (src/lib/image.ts).
 * Run: set -a; source .env; set +a; npx tsx scripts/test-image-wavespeed.ts
 * (costs $0.005 per run on the default z-image/turbo model)
 */
import { generateImage, imageDiagnostics } from "../src/lib/image";
import { writeFileSync } from "fs";

async function main() {
  console.log("diagnostics:", JSON.stringify(imageDiagnostics(), null, 2));

  const res = await generateImage({
    prompt: "a fluffy orange cat astronaut on Mars, cinematic lighting, ultra detailed",
    aspectRatio: "16:9",
  });
  console.log("PROVIDER:", res.provider, "| MODEL:", res.model, "| WARNINGS:", res.warnings ?? []);

  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(res.imageDataUrl);
  if (!m) {
    console.error("FAIL: imageDataUrl is not a base64 data URL");
    process.exit(1);
  }
  const buf = Buffer.from(m[2], "base64");
  const ext = m[1].includes("png") ? "png" : "jpg";
  const out = `/home/z/my-project/scripts/img-test-output.${ext}`;
  writeFileSync(out, buf);
  console.log(`SAVED: ${out} (${buf.length} bytes, ${m[1]})`);
  if (buf.length < 10_000) {
    console.error("FAIL: image suspiciously small");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((e) => {
  console.error("ERROR:", e?.name, e?.message, e?.status ? `(status ${e.status})` : "");
  process.exit(1);
});
