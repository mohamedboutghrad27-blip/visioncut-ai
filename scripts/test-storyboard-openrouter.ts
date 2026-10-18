/**
 * E2E test: /api/ai/storyboard via OpenRouter (nvidia/nemotron-3.5-super-vl:free)
 * Flow: demo login -> GET diagnostics -> POST script -> validate storyboard JSON.
 * Env must be sourced (use scripts/with-neon-env.sh).
 */
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3000";

async function main() {
  // 1. demo login
  const login = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  if (!login.ok) throw new Error(`demo login failed: ${login.status}`);
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("no session cookie set");
  console.log("LOGIN_OK");

  // 2. diagnostics (masked)
  const diag = await (await fetch(`${BASE}/api/ai/storyboard`, { headers: { cookie } })).json();
  console.log("DIAG:", JSON.stringify(diag));
  if (!diag.openrouter?.hasKey) throw new Error("OPENROUTER_API_KEY not visible to runtime");

  // 3. real generation
  const script = `A short promo film for a mountain coffee brand. Dawn breaks over snowy peaks as a barista grinds beans outside a wooden cabin. Steam rises from a steel cup while golden light floods the valley. A hiker takes the first sip and smiles, then treks upward along the ridge into the clouds.`;
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/ai/storyboard`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ script, style: "cinematic", aspectRatio: "16:9" }),
  });
  const ms = Date.now() - t0;
  const data = await res.json();
  console.log(`STORYBOARD HTTP ${res.status} in ${(ms / 1000).toFixed(1)}s`);
  if (!res.ok) throw new Error(`storyboard failed: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);

  console.log("provider:", data.provider, "| model:", data.model);
  const sb = data.storyboard || {};
  if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) throw new Error("no scenes returned");
  for (const s of sb.scenes) {
    const req = ["index", "visual", "narration", "caption", "transition", "durationSeconds", "imagePrompt"];
    const missing = req.filter((k) => s[k] === undefined || s[k] === null || s[k] === "");
    if (missing.length) throw new Error(`scene ${s.index} missing: ${missing.join(",")}`);
    if (typeof s.durationSeconds !== "number" || s.durationSeconds < 3 || s.durationSeconds > 8)
      throw new Error(`scene ${s.index} bad durationSeconds: ${s.durationSeconds}`);
    if (!["cut", "fade", "slide"].includes(s.transition))
      throw new Error(`scene ${s.index} bad transition: ${s.transition}`);
  }
  console.log(`SCENES_OK count=${sb.scenes.length} title="${sb.title}" music="${(sb.musicSuggestion || "").slice(0, 60)}"`);
  console.log("E2E_PASS");
}

main().catch((e) => {
  console.error("E2E_FAIL:", e.message);
  process.exit(1);
});
