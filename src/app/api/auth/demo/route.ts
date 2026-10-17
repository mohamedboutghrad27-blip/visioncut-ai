import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie, hashPassword } from "@/lib/auth";

const DEMO_EMAIL = "demo@visioncut.ai";
const DEMO_PASSWORD = "visioncut-demo-2026";

// Starter project state for the demo account (clearly labeled as example content)
const demoProjectData = JSON.stringify({
  version: 1,
  tracks: [
    { id: "vt1", type: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
    { id: "at1", type: "audio", name: "Audio 1", muted: false, hidden: false, locked: false, height: 56 },
  ],
  clips: [
    {
      id: "demo-clip-1", trackId: "vt1", type: "text", name: "Title — VisionCut AI",
      start: 0, duration: 4, trimStart: 0, volume: 1, speed: 1, opacity: 1,
      x: 0, y: -0.05, scale: 1, rotation: 0,
      text: { content: "VisionCut AI", fontSize: 0.09, color: "#ffffff", weight: 700, align: "center", family: "display", bgOpacity: 0, letterSpacing: 0 },
      animation: "fadeIn", animationDuration: 1,
    },
    {
      id: "demo-clip-2", trackId: "vt1", type: "text", name: "Subtitle",
      start: 4, duration: 4, trimStart: 0, volume: 1, speed: 1, opacity: 1,
      x: 0, y: 0.06, scale: 1, rotation: 0,
      text: { content: "This is an example project — replace it with your own media.", fontSize: 0.045, color: "#c4b5fd", weight: 500, align: "center", family: "sans", bgOpacity: 0, letterSpacing: 0 },
      animation: "none", animationDuration: 0.5,
    },
  ],
  duration: 8,
});

export async function POST() {
  try {
    let user = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: DEMO_EMAIL,
          name: "Demo Creator",
          passwordHash: hashPassword(DEMO_PASSWORD),
          isDemo: true,
          avatarColor: "#8b5cf6",
        },
      });
    } else if (!user.isDemo) {
      return NextResponse.json({ error: "Demo account unavailable." }, { status: 400 });
    }

    // Seed one example project if the demo user has none
    const count = await db.project.count({ where: { userId: user.id } });
    if (count === 0) {
      await db.project.create({
        data: {
          userId: user.id,
          name: "Example — Welcome to VisionCut",
          aspectRatio: "16:9",
          data: demoProjectData,
          isDemo: true,
        },
      });
      await db.project.create({
        data: {
          userId: user.id,
          name: "Example — Product Teaser (empty)",
          aspectRatio: "9:16",
          data: JSON.stringify({ version: 1, tracks: [
            { id: "vt1", type: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
          ], clips: [], duration: 0 }),
          isDemo: true,
        },
      });
    }

    await setSessionCookie(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor, isDemo: true },
      demoCredentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
  } catch (err) {
    console.error("[auth/demo]", err);
    return NextResponse.json({ error: "Could not start demo mode." }, { status: 500 });
  }
}
