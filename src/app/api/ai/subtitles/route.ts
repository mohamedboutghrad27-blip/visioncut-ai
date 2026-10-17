import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth";

const schema = z.object({
  audioBase64: z.string().min(64).max(24_000_000), // ~18MB binary cap as base64
  duration: z.number().positive().max(3600).optional(),
  languageHint: z.string().max(30).optional(),
});

/**
 * Automatic subtitles via speech-to-text.
 * The client extracts the audio track (WebAudio → WAV) and sends it as base64.
 * The ASR service returns plain text; timings are estimated by distributing
 * words proportionally across the provided duration. This is clearly labeled
 * as "estimated timing" in the editor UI.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const zai = await ZAI.create();
    const result = await zai.audio.asr.create({ file_base64: parsed.data.audioBase64 });
    const text = (result.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "No speech was detected in this audio." }, { status: 422 });
    }

    // Segment into caption-sized chunks (~8 words) with proportional estimated timing
    const words = text.split(/\s+/).filter(Boolean);
    const duration = parsed.data.duration || Math.max(4, words.length / 2.6);
    const chunks: { text: string; start: number; end: number }[] = [];
    const WORDS_PER_CAPTION = 8;
    let idx = 0;
    while (idx < words.length) {
      const slice = words.slice(idx, idx + WORDS_PER_CAPTION);
      const startT = (idx / words.length) * duration;
      const endT = (Math.min(idx + WORDS_PER_CAPTION, words.length) / words.length) * duration;
      chunks.push({ text: slice.join(" "), start: Math.round(startT * 100) / 100, end: Math.round(endT * 100) / 100 });
      idx += WORDS_PER_CAPTION;
    }

    return NextResponse.json({ text, captions: chunks, timingMode: "estimated" });
  } catch (err) {
    console.error("[ai/subtitles]", err);
    return NextResponse.json({ error: "Speech recognition failed. Make sure the clip has a clear audio track." }, { status: 500 });
  }
}
