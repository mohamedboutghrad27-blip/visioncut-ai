import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth";

const schema = z.object({
  text: z.string().trim().min(1, "Enter some text to narrate").max(2000),
  voice: z.string().max(40).optional(),
  speed: z.number().min(0.5).max(2).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({
      input: parsed.data.text,
      voice: parsed.data.voice || "tongtong",
      speed: parsed.data.speed ?? 1.0,
      response_format: "wav",
      stream: false,
    });
    const contentType = response.headers.get("content-type") || "audio/wav";
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength < 512) {
      return NextResponse.json({ error: "The speech service returned no audio. Try shorter text." }, { status: 502 });
    }
    const base64 = Buffer.from(new Uint8Array(arrayBuffer)).toString("base64");
    return NextResponse.json({
      audioDataUrl: `data:${contentType.split(";")[0]};base64,${base64}`,
      bytes: arrayBuffer.byteLength,
    });
  } catch (err) {
    console.error("[ai/voiceover]", err);
    return NextResponse.json({ error: "Voiceover generation failed. Please try again shortly." }, { status: 500 });
  }
}
