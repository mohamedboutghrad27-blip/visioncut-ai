import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { generateVoiceover, VoiceoverError, voiceoverDiagnostics } from "@/lib/voiceover";

const schema = z.object({
  text: z.string().trim().min(1, "Enter some text to narrate").max(2000),
  voice: z.string().max(40).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  quality: z.enum(["fast", "hd"]).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const result = await generateVoiceover(parsed.data);
    const bytes = Math.floor((result.audioDataUrl.split(",")[1]?.length || 0) * 0.75);
    return NextResponse.json({
      audioDataUrl: result.audioDataUrl,
      bytes,
      provider: result.provider,
      model: result.model,
      warnings: result.warnings ?? [],
    });
  } catch (err) {
    if (err instanceof VoiceoverError) {
      console.error("[ai/voiceover]", err.provider, err.message);
      return NextResponse.json({ error: err.message, provider: err.provider }, { status: err.status });
    }
    console.error("[ai/voiceover]", err);
    return NextResponse.json({ error: "Voiceover generation failed. Please try again shortly." }, { status: 500 });
  }
}
