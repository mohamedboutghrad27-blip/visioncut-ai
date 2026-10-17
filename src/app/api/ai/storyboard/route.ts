import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth";

const schema = z.object({
  script: z.string().trim().min(20, "Script must be at least 20 characters").max(6000),
  style: z.string().max(60).optional(),
  aspectRatio: z.string().max(10).optional(),
});

const SCENE_SCHEMA = `Return STRICT JSON only (no markdown fences) shaped as:
{"title":string,"scenes":[{"index":number,"visual":string,"narration":string,"caption":string,"transition":"cut"|"fade"|"slide","durationSeconds":number,"imagePrompt":string}],"musicSuggestion":string}
Rules: 3-6 scenes. durationSeconds between 3 and 8. imagePrompt is an English text-to-image prompt describing the scene visually, rich in detail, no text/watermarks in the image.`;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const { script, style, aspectRatio } = parsed.data;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "You are a professional video director and storyboard artist. You convert scripts into precise, production-ready storyboards. Always answer with valid JSON matching the requested schema, nothing else.",
        },
        {
          role: "user",
          content: `Convert this script into a scene-by-scene storyboard.\nVisual style: ${style || "cinematic"}\nAspect ratio: ${aspectRatio || "16:9"}\n\nSCRIPT:\n${script}\n\n${SCENE_SCHEMA}`,
        },
      ],
      thinking: { type: "disabled" },
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || "";
    // Robust JSON extraction (model may wrap in fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "The AI returned an unreadable storyboard. Please try again." }, { status: 502 });
    }
    let storyboard;
    try {
      storyboard = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "The AI returned a malformed storyboard. Please try again." }, { status: 502 });
    }
    if (!Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
      return NextResponse.json({ error: "The AI produced no scenes. Please rephrase your script and try again." }, { status: 502 });
    }
    return NextResponse.json({ storyboard });
  } catch (err) {
    console.error("[ai/storyboard]", err);
    return NextResponse.json({ error: "Storyboard generation failed. Please try again shortly." }, { status: 500 });
  }
}
