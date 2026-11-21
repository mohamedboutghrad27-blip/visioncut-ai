/**
 * GET /api/admin/stats  (X-Admin-Key header or ?key=)
 *
 * One-shot operational snapshot for the admin panel: user signups, projects,
 * timeline clips, cloud media storage, pending password resets, aspect-ratio
 * distribution and the 50 most recent users/projects.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Editor state stores clips flat (each carries trackId) or nested per track. */
function countClips(dataStr: string): number {
  try {
    const data = JSON.parse(dataStr || "{}") as {
      tracks?: Array<{ clips?: unknown[] }>;
      clips?: unknown[];
    };
    let clips = Array.isArray(data.clips) ? data.clips.length : 0;
    if (!clips) {
      clips = (data.tracks || []).reduce(
        (n, t) => n + (Array.isArray(t.clips) ? t.clips.length : 0),
        0,
      );
    }
    return clips;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Pass the admin key as X-Admin-Key header or ?key=." },
      { status: 401 },
    );
  }

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 864e5);
  const d30 = new Date(now.getTime() - 30 * 864e5);

  const [
    usersTotal,
    users7d,
    users30d,
    demoUsers,
    projectsTotal,
    demoProjects,
    mediaCount,
    mediaAgg,
    pendingResets,
    aspectGroups,
    recentUsers,
    recentProjects,
    allProjectsData,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: d7 } } }),
    db.user.count({ where: { createdAt: { gte: d30 } } }),
    db.user.count({ where: { isDemo: true } }),
    db.project.count(),
    db.project.count({ where: { isDemo: true } }),
    db.mediaFile.count(),
    db.mediaFile.aggregate({ _sum: { size: true } }),
    db.passwordReset.count({ where: { usedAt: null, expiresAt: { gt: now } } }),
    db.project.groupBy({ by: ["aspectRatio"], _count: { _all: true } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        isDemo: true,
        createdAt: true,
        _count: { select: { projects: true, mediaFiles: true } },
      },
    }),
    db.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        aspectRatio: true,
        isDemo: true,
        updatedAt: true,
        data: true,
        user: { select: { email: true } },
      },
    }),
    db.project.findMany({ select: { data: true } }),
  ]);

  const clipsTotal = allProjectsData.reduce((n, p) => n + countClips(p.data), 0);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    users: { total: usersTotal, last7d: users7d, last30d: users30d, demo: demoUsers },
    projects: {
      total: projectsTotal,
      demo: demoProjects,
      clipsTotal,
      byAspect: aspectGroups
        .map((g) => ({ aspect: g.aspectRatio, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      recent: recentProjects.map((p) => ({
        id: p.id,
        name: p.name,
        aspectRatio: p.aspectRatio,
        isDemo: p.isDemo,
        clips: countClips(p.data),
        updatedAt: p.updatedAt.toISOString(),
        owner: p.user.email,
      })),
    },
    media: { files: mediaCount, bytes: mediaAgg._sum.size ?? 0 },
    resets: { pending: pendingResets },
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isDemo: u.isDemo,
      createdAt: u.createdAt.toISOString(),
      projects: u._count.projects,
      media: u._count.mediaFiles,
    })),
  });
}
