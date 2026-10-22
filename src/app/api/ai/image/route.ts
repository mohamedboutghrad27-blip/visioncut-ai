import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { generateImage } from "@/lib/image";

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
    const result = await generateImage({ prompt: parsed.data.prompt, aspectRatio: parsed.data.aspectRatio });
    return NextResponse.json({ imageDataUrl: result.imageDataUrl, warnings: result.warnings ?? [] });
  } catch (err) {
    console.error("[ai/image]", err);
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Image generation failed. Please try again shortly.";
    return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
