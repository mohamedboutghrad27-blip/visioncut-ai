"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { ASPECT_DIMS, formatTimecode, type AspectRatio } from "@/lib/editor/types";
import { renderFrame, syncMedia, pauseAllMedia, hydrateClipUrl } from "@/lib/editor/engine";
import {
  Play, Pause, SkipBack, SkipForward, Maximize, Minimize, Scan, Repeat,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const QUALITY_SCALES: Record<string, number> = { full: 1, half: 0.66, quarter: 0.4 };

function ControlBtn({
  children, label, onClick, active, disabled, className,
}: {
  children: React.ReactNode; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-35",
              active && "bg-violet-500/20 text-violet-300 hover:bg-violet-500/25",
              className
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="border-white/10 bg-[#101018] text-xs text-zinc-300">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playing = useEditor((s) => s.playing);
  const aspectRatio = useEditor((s) => s.project.aspectRatio);
  const clipCount = useEditor((s) => s.project.clips.length);
  const quality = useEditor((s) => s.previewQualityScale);
  const showGuides = useEditor((s) => s.showRatioGuides);
  const loop = useEditor((s) => s.loop);
  const [isFullscreen, setFullscreen] = useState(false);
  const [zoomMode, setZoomMode] = useState<"fit" | "50" | "100">("fit");
  const scrubbingRef = useRef(false);

  /* ------------- playback + render loop ------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const store = useEditor.getState();
      const { project } = store;

      // hydrate any clips that are missing their media URL
      for (const clip of project.clips) {
        if ((clip.type === "video" || clip.type === "audio") && clip.assetId && !(clip as unknown as { _url?: string })._url) {
          hydrateClipUrl(clip);
          break; // one per frame is plenty
        }
      }

      let t = store.playhead;
      const duration = project.duration;
      if (store.playing) {
        t += dt;
        if (t >= duration) {
          if (store.loop && duration > 0) {
            t = 0;
          } else {
            t = duration;
            store.setPlaying(false);
            pauseAllMedia();
          }
        }
        store.setPlayhead(t);
      }

      syncMedia(project, t, project.assets, { playing: store.playing });

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { alpha: false });
      if (!canvas || !ctx) return;
      renderFrame(ctx, project, t, project.assets, { showGuides: store.showRatioGuides, width: canvas.width, height: canvas.height });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      pauseAllMedia();
    };
  }, []);

  /* canvas internal resolution follows aspect ratio + quality */
  const dims = ASPECT_DIMS[aspectRatio as AspectRatio] || ASPECT_DIMS["16:9"];
  const baseH = 1080;
  const scale = baseH / dims.h * quality;
  const canvasW = Math.round(dims.w * scale);
  const canvasH = Math.round(dims.h * scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvasW;
      canvas.height = canvasH;
    }
  }, [canvasW, canvasH]);

  /* fullscreen tracking */
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const totalDuration = useEditor((s) => s.project.duration);

  const togglePlay = useCallback(() => {
    const store = useEditor.getState();
    if (!store.playing && store.playhead >= store.project.duration - 0.01 && store.project.duration > 0) {
      store.setPlayhead(0);
    }
    store.setPlaying(!store.playing);
  }, []);

  const seekTo = useCallback((t: number) => {
    const store = useEditor.getState();
    store.setPlayhead(Math.max(0, Math.min(store.project.duration, t)));
  }, []);

  /* scrub by clicking / dragging on the canvas */
  const onCanvasPointer = (e: React.PointerEvent) => {
    if (scrubbingRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    seekTo(frac * totalDuration);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapRef.current?.requestFullscreen();
  };

  const displayZoom = zoomMode === "fit" ? undefined : Number(zoomMode) / 100;

  return (
    <div className="flex h-full flex-col bg-[#07070c]">
      {/* canvas area — intrinsic canvas ratio + max constraints keep it always proportional */}
      <div ref={wrapRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#050508] p-4">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
        {clipCount === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-zinc-400">
              Your canvas is empty
            </span>
            <p className="max-w-60 text-[11px] leading-relaxed text-zinc-600">
              Import media from the left panel and drag it onto the timeline to begin.
            </p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={cn("rounded-lg border border-white/10 bg-black shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9)]", !displayZoom && "max-h-full max-w-full")}
          style={displayZoom ? { width: canvasW * displayZoom, height: canvasH * displayZoom } : undefined}
          onPointerDown={onCanvasPointer}
          onDoubleClick={toggleFullscreen}
          aria-label="Video preview canvas — click to seek"
        />
      </div>

      {/* controls */}
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-t border-white/8 bg-[#0a0a12] px-3">
        <ControlBtn label="Jump to start" onClick={() => seekTo(0)}>
          <SkipBack className="h-4 w-4" />
        </ControlBtn>
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-[0_0_14px_rgba(255,255,255,0.25)] transition-transform hover:scale-105"
        >
          {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
        </button>
        <ControlBtn label="Jump to end" onClick={() => seekTo(totalDuration)}>
          <SkipForward className="h-4 w-4" />
        </ControlBtn>

        <TimecodeDisplay />

        <div className="mx-1.5 h-5 w-px bg-white/10" />
        <ControlBtn label="Loop playback" active={loop} onClick={() => useEditor.getState().setLoop(!loop)}>
          <Repeat className="h-4 w-4" />
        </ControlBtn>
        <ControlBtn label="Aspect ratio guides" active={showGuides} onClick={() => useEditor.getState().setShowRatioGuides(!showGuides)}>
          <Scan className="h-4 w-4" />
        </ControlBtn>

        <div className="ml-auto flex items-center gap-1.5">
          <Select value={zoomMode} onValueChange={(v) => setZoomMode(v as "fit" | "50" | "100")}>
            <SelectTrigger className="h-7 w-[84px] border-white/10 bg-white/[0.04] text-[11px] text-zinc-300 focus:ring-violet-400/40" aria-label="Preview zoom">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101018]">
              <SelectItem value="fit" className="text-[11px] text-zinc-300">Fit</SelectItem>
              <SelectItem value="50" className="text-[11px] text-zinc-300">50%</SelectItem>
              <SelectItem value="100" className="text-[11px] text-zinc-300">100%</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={quality === 1 ? "full" : quality === 0.66 ? "half" : "quarter"}
            onValueChange={(v) => useEditor.getState().setPreviewQualityScale(QUALITY_SCALES[v])}
          >
            <SelectTrigger className="h-7 w-[104px] border-white/10 bg-white/[0.04] text-[11px] text-zinc-300 focus:ring-violet-400/40" aria-label="Preview quality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101018]">
              <SelectItem value="full" className="text-[11px] text-zinc-300">Full (1080p)</SelectItem>
              <SelectItem value="half" className="text-[11px] text-zinc-300">Half (720p)</SelectItem>
              <SelectItem value="quarter" className="text-[11px] text-zinc-300">Quarter (432p)</SelectItem>
            </SelectContent>
          </Select>

          <ControlBtn label="Fullscreen preview" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </ControlBtn>
        </div>
      </div>
    </div>
  );
}

function TimecodeDisplay() {
  const playhead = useEditor((s) => s.playhead);
  const duration = useEditor((s) => s.project.duration);
  const fps = 30;
  return (
    <span className="ml-2 rounded-md border border-white/8 bg-black/40 px-2 py-1 font-mono text-[11px] tabular-nums text-emerald-300">
      {formatTimecode(playhead, fps)}
      <span className="mx-1 text-zinc-600">/</span>
      <span className="text-zinc-400">{formatTimecode(duration, fps)}</span>
    </span>
  );
}
