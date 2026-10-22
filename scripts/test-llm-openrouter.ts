/**
 * Local E2E check of the script-generation LLM path (src/lib/llm.ts).
 * Run: set -a; source .env; set +a; npx tsx scripts/test-llm-openrouter.ts
 * (uses CUSTOM_LLM_* env vars — OpenRouter free tier: 50 req/day)
 */
import { generateChatCompletion, extractJsonObject, llmDiagnostics } from "../src/lib/llm";

async function main() {
  console.log("diagnostics:", JSON.stringify(llmDiagnostics(), null, 2));

  const res = await generateChatCompletion(
    [
      {
        role: "system",
        content:
          "You are a senior short-form video director. Reply with a single valid JSON object only — no prose.",
      },
      {
        role: "user",
        content:
          'Create a 3-scene vertical-video storyboard about "a cat astronaut exploring Mars". ' +
          'Schema: {"title": string, "scenes": [{"id": number, "shot": string, "visualPrompt": string, "narration": string}]}',
      },
    ],
    { temperature: 0.7 },
  );
  console.log("PROVIDER:", res.provider, "| MODEL:", res.model, "| USAGE:", res.usage);

  const parsed = extractJsonObject(res.content);
  if (!parsed) {
    console.error("FAIL: could not extract JSON from completion:", res.content.slice(0, 400));
    process.exit(1);
  }
  console.log("PARSED JSON:", JSON.stringify(parsed, null, 2).slice(0, 700));
  const scenes = (parsed as { scenes?: unknown[] }).scenes;
  if (!Array.isArray(scenes) || scenes.length < 1) {
    console.error("FAIL: no scenes array in storyboard JSON");
    process.exit(1);
  }
  console.log(`PASS (${scenes.length} scenes)`);
}

main().catch((e) => {
  console.error("ERROR:", e?.name, e?.message, e?.status ? `(status ${e.status})` : "");
  process.exit(1);
});
