import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth";

const SIZE_BY_RATIO: Record<string, string> = {
  "16:9": "1344x768",
  "9:16": "768x1344",
  "1:1": "1024x1024",
  "4:5": "864x1152",
  "21:9": "1440x720",
};

const schema = z.object({
  prompt: z.string().trim().min(3, "Describe the image you want").max(1500),
  aspectRatio: z.string().max(10).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const size = SIZE_BY_RATIO[parsed.data.aspectRatio || "16:9"] || "1344x768";
    const zai = await ZAI.create();
    const response = await zai.images.generations.create({
      prompt: parsed.data.prompt,
      size: size as "1024x1024",
    });
    const base64 = response.data?.[0]?.base64;
    if (!base64) {
      return NextResponse.json({ error: "The image service returned no data. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ imageDataUrl: `data:image/png;base64,${base64}` });
  } catch (err) {
    console.error("[ai/image]", err);
    return NextResponse.json({ error: "Image generation failed. Please try again shortly." }, { status: 500 });
  }
}
