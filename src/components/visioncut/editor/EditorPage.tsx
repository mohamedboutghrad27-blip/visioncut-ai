"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { useEditor } from "@/lib/editor/store";
import { type ProjectState, type AspectRatio } from "@/lib/editor/types";
import { getAssetUrl } from "@/lib/editor/idb";
import { releaseAllMedia, pauseAllMedia } from "@/lib/editor/engine";
import { Toolbar } from "@/components/visioncut/editor/Toolbar";
import { LeftSidebar } from "@/components/visioncut/editor/LeftSidebar";
import { Preview } from "@/components/visioncut/editor/Preview";
import { Properties } from "@/components/visioncut/editor/Properties";
import { Timeline } from "@/components/visioncut/editor/Timeline";
import { ExportDialog } from "@/components/visioncut/editor/ExportDialog";
import { ResizablePanelGroup as PanelGroup, ResizablePanel as Panel, ResizableHandle as PanelResizeHandle } from "@/components/ui/resizable";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function EditorPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const loadProject = useEditor((s) => s.loadProject);
  const project = useEditor((s) => s.project);
  const saveStatus = useEditor((s) => s.saveStatus);

  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [missingMedia, setMissingMedia] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  /* ---------------- auth guard ---------------- */
  useEffect(() => {
    if (!authLoading && !user) router.navigate("/login");
  }, [authLoading, user, router]);

  /* ---------------- initial load ---------------- */
  useEffect(() => {
    if (!user || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
        if (res.status === 401) return router.navigate("/login");
        if (res.status === 404) {
          setFatal("This project doesn't exist or isn't yours.");
          setLoading(false);
          return;
        }
        const { project: row } = await res.json();
        let parsed: ProjectState;
        try {
          parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        } catch {
          setFatal("The saved project data is corrupted and can't be opened.");
          setLoading(false);
          return;
        }
        // Hydrate defaults
        parsed.version = 1;
        parsed.name = row.name;
        parsed.aspectRatio = (row.aspectRatio || "16:9") as AspectRatio;
        parsed.assets = parsed.assets || [];
        parsed.clips = parsed.clips || [];
        parsed.tracks = parsed.tracks?.length ? parsed.tracks : [
          { id: "v1", type: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
          { id: "a1", type: "audio", name: "Audio 1", muted: false, hidden: false, locked: false, height: 56 },
        ];

        // Resolve asset blob URLs; detect missing blobs
        let missing = 0;
        await Promise.all(
          parsed.clips.map(async (clip) => {
            if ((clip.type === "video" || clip.type === "audio" || clip.type === "image") && clip.assetId) {
              const url = await getAssetUrl(clip.assetId);
              if (url) {
                (clip as unknown as { _url?: string })._url = url;
              } else {
                missing++;
              }
            }
            return clip;
          })
        );
        if (missing > 0) {
          setMissingMedia(true);
          toast.warning(`${missing} media file${missing > 1 ? "s" : ""} could not be restored`, {
            description: "These files are not in this browser's cache nor the cloud backup. Re-import them to restore those clips.",
          });
        }

        parsed.duration = parsed.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
        loadProject(projectId, parsed);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setFatal("Could not load this project. Check your connection and try again.");
        setLoading(false);
      }
    })();
  }, [user, projectId, loadProject, router]);

  /* ---------------- autosave (debounced) ---------------- */
  const serialize = useCallback(() => {
    return JSON.stringify(project, (key, value) => (key.startsWith("_") ? undefined : value));
  }, [project]);

  const saveNow = useCallback(async () => {
    const store = useEditor.getState();
    if (!store.projectId) return;
    store.setSaveStatus("saving");
    try {
      // capture a fresh thumbnail from the current playhead
      const thumbnail = await captureThumbnail();
      const res = await fetch(`/api/projects/${store.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: store.project.name,
          aspectRatio: store.project.aspectRatio,
          data: serialize(),
          ...(thumbnail ? { thumbnail } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      store.markSaved();
    } catch (err) {
      useEditor.getState().setSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Autosave failed — press Ctrl/Cmd+S to retry.");
    }
  }, [serialize]);

  /* explicit save requests from the toolbar */
  const saveRequestTick = useEditor((s) => s.saveRequestTick);
  useEffect(() => {
    if (saveRequestTick > 0 && !loading) saveNow();
  }, [saveRequestTick, loading, saveNow]);

  useEffect(() => {
    if (!loading && project && saveStatus === "unsaved") {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(saveNow, 1400);
      return () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
      };
    }
  }, [project, saveStatus, loading, saveNow]);

  /* ---------------- unload guard ---------------- */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().saveStatus === "unsaved") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      // best-effort flush on unmount
      if (useEditor.getState().saveStatus === "unsaved") saveNow();
    };
  }, [saveNow]);

  /* ---------------- keyboard shortcuts ---------------- */
  useEffect(() => {
    if (loading) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      const store = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === "Space") {
        e.preventDefault();
        store.setPlaying(!store.playing);
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (useEditor.getState().saveStatus !== "saved") useEditor.getState().setSaveStatus("unsaved");
        useEditor.getState().requestSave();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (store.selection) store.duplicateClip(store.selection);
      } else if (e.key.toLowerCase() === "s" && !mod) {
        if (store.selection) store.splitClip(store.selection, store.playhead);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selection) {
          e.preventDefault();
          store.removeClip(store.selection);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        store.setPlayhead(Math.min(store.project.duration, store.playhead + 1 / 30));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        store.setPlayhead(Math.max(0, store.playhead - 1 / 30));
      } else if (e.key === "Escape") {
        store.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, saveNow]);

  /* cleanup media on unmount */
  useEffect(() => () => { releaseAllMedia(); pauseAllMedia(); }, []);

  if (authLoading || (loading && !fatal)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#050508]">
        <div className="relative">
          <Loader2 className="h-9 w-9 animate-spin text-zinc-400" />
          <div className="absolute inset-0 -z-10 blur-xl bg-white/20 rounded-full" />
        </div>
        <p className="text-sm text-zinc-500">Loading your editing studio…</p>
      </div>
    );
  }

  if (fatal) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#050508] px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <h1 className="font-display text-xl font-semibold text-white">{fatal}</h1>
        <button
          onClick={() => router.navigate("/dashboard")}
          className="rounded-lg bg-[#ededf2] px-6 py-2.5 text-sm font-medium text-black hover:bg-white"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508] text-foreground select-none">
      <Toolbar onOpenExport={() => setExportOpen(true)} />
      {missingMedia && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-[11px] text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          Some media files could not be restored in this browser — clips referencing them will show black until re-imported.
        </div>
      )}
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={19} minSize={12} maxSize={32} className="min-w-0">
            <LeftSidebar />
          </Panel>
          <PanelResizeHandle className="w-[3px] bg-white/5 transition-colors hover:bg-violet-500/40" />
          <Panel defaultSize={54} className="min-w-0">
            <Preview />
          </Panel>
          <PanelResizeHandle className="w-[3px] bg-white/5 transition-colors hover:bg-violet-500/40" />
          <Panel defaultSize={27} minSize={16} maxSize={40} className="min-w-0">
            <Properties />
          </Panel>
        </PanelGroup>
      </div>
      <div className="h-[38%] min-h-[220px] shrink-0">
        <PanelGroup direction="vertical" className="h-full">
          <Panel className="min-h-0">
            <Timeline />
          </Panel>
        </PanelGroup>
      </div>
      <ExportDialog key={exportOpen ? "export-open" : "export-closed"} open={exportOpen} onOpenChange={setExportOpen} onExported={saveNow} />
    </div>
  );
}

/** Render the current playhead frame to a small JPEG for the dashboard thumbnail. */
async function captureThumbnail(): Promise<string | null> {
  try {
    const store = useEditor.getState();
    if (store.project.clips.length === 0) return null;
    const { ASPECT_DIMS } = await import("@/lib/editor/types");
    const dims = ASPECT_DIMS[store.project.aspectRatio] || ASPECT_DIMS["16:9"];
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = Math.round((480 * dims.h) / dims.w);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const { renderFrame } = await import("@/lib/editor/engine");
    renderFrame(ctx, store.project, Math.min(store.playhead, store.project.duration || 0), store.project.assets, {
      width: canvas.width,
      height: canvas.height,
    });
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}
