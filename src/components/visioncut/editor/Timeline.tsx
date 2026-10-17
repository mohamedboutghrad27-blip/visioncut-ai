"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import {
  type Clip, type Track, clipEnd, formatDuration,
} from "@/lib/editor/types";
import { getAssetUrl } from "@/lib/editor/idb";
import { computePeaks } from "@/lib/editor/waveform";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Copy, Eye, EyeOff, Lock, LockOpen, Magnet, Music, Plus, Scissors,
  Trash2, Type as TypeIcon, Video, Volume2, VolumeX, Image as ImageIcon, ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TRACK_TYPE_COLORS: Record<string, string> = {
  video: "bg-gradient-to-b from-violet-600/70 to-violet-800/70 border-violet-400/40",
  image: "bg-gradient-to-b from-sky-600/70 to-sky-800/70 border-sky-400/40",
  audio: "bg-gradient-to-b from-emerald-600/60 to-emerald-800/60 border-emerald-400/40",
  text: "bg-gradient-to-b from-amber-500/70 to-amber-700/70 border-amber-300/40",
};

function Ruler({
  zoom, duration, scrollRef,
}: { zoom: number; duration: number; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);

  const scrub = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      useEditor.getState().setPlayhead(Math.max(0, Math.min(duration + 5, x / zoom)));
    },
    [zoom, duration]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrub(e.clientX);
    const move = (ev: PointerEvent) => scrub(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const tickStep0 = zoom > 160 ? 0.5 : zoom > 80 ? 1 : zoom > 40 ? 2 : zoom > 16 ? 5 : 10;
  let tickStep = tickStep0;
  while ((duration + 5) / tickStep > 1500) tickStep *= 2;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 5; t += tickStep) ticks.push(t);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="sticky top-0 z-10 h-7 cursor-ew-resize border-b border-white/8 bg-[#08080e] select-none"
      aria-label="Timeline ruler — click or drag to scrub"
    >
      {ticks.map((t) => (
        <div key={t} className="absolute top-0 h-full" style={{ left: t * zoom }}>
          <div className="h-2 w-px bg-white/15" />
          {(t / tickStep) % (tickStep >= 2 ? 1 : 2) === 0 && (
            <span className="absolute left-1 top-1.5 font-mono text-[9px] text-zinc-500">{formatDuration(t)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function PlayheadLine({ zoom }: { zoom: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const playhead = useEditor((s) => s.playhead);
  useEffect(() => {
    if (ref.current) ref.current.style.transform = `translateX(${playhead * zoom}px)`;
  }, [playhead, zoom]);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]"
      style={{ willChange: "transform" }}
      aria-hidden
    >
      <div className="absolute -left-[5px] -top-[1px] h-2.5 w-2.5 rotate-45 rounded-[2px] bg-violet-400" />
    </div>
  );
}

function Waveform({ clip, height }: { clip: Clip; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const assetId = clip.assetId;
  const peaks = clip.peaks;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks || peaks.length === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(110, 231, 183, 0.75)";
    const bar = Math.max(1.5, w / peaks.length);
    const mid = h / 2;
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const bh = Math.max(1, peaks[i] * (h * 0.85));
      ctx.fillRect(x, mid - bh / 2, bar, bh);
    }
  }, [peaks, clip.duration, height]);

  if (!peaks || peaks.length === 0) return null;
  return <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-80" aria-hidden />;
}

/** Ensure waveform peaks exist for audio/video clips of this project. */
function usePeaksHydration() {
  const clips = useEditor((s) => s.project.clips);
  const assets = useEditor((s) => s.project.assets);
  const updateClip = useEditor((s) => s.updateClip);
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const clip of clips) {
      if ((clip.type === "audio" || clip.type === "video") && clip.assetId && !clip.peaks && !attempted.current.has(clip.assetId)) {
        attempted.current.add(clip.assetId);
        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset || asset.size > 120 * 1024 * 1024) continue;
        (async () => {
          try {
            const url = await getAssetUrl(asset.id);
            if (!url) return;
            const blob = await (await fetch(url)).blob();
            const peaks = await computePeaks(asset.id, blob);
            if (peaks.length) {
              const store = useEditor.getState();
              for (const c of store.project.clips) {
                if (c.assetId === asset.id && !c.peaks) {
                  store.updateClip(c.id, { peaks }, { history: false });
                }
              }
            }
          } catch { /* waveform is best-effort */ }
        })();
      }
    }
  }, [clips, assets, updateClip]);
}

type DragState =
  | { mode: "move"; clipId: string; origStart: number; origTrackId: string; grabOffsetX: number; grabOffsetY: number }
  | { mode: "trim-l"; clipId: string; origStart: number; origDuration: number; origTrimStart: number }
  | { mode: "trim-r"; clipId: string; origDuration: number; origTrimStart: number }
  | null;

export function Timeline() {
  const project = useEditor((s) => s.project);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const snapping = useEditor((s) => s.snapping);
  const setSnapping = useEditor((s) => s.setSnapping);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const updateClip = useEditor((s) => s.updateClip);
  const splitClip = useEditor((s) => s.splitClip);
  const removeClip = useEditor((s) => s.removeClip);
  const duplicateClip = useEditor((s) => s.duplicateClip);
  const addTrack = useEditor((s) => s.addTrack);
  const updateTrack = useEditor((s) => s.updateTrack);
  const removeTrack = useEditor((s) => s.removeTrack);
  const playhead = useEditor((s) => s.playhead);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const [dragOverTrack, setDragOverTrack] = useState<string | null>(null);

  usePeaksHydration();

  const duration = Math.max(project.duration, 12);

  /* keep playhead in view while playing */
  const playheadX = playhead * zoom;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const viewStart = el.scrollLeft;
    const viewEnd = viewStart + el.clientWidth;
    if (playheadX > viewEnd - 80 || playheadX < viewStart) {
      el.scrollLeft = Math.max(0, playheadX - el.clientWidth * 0.35);
    }
  }, [playheadX]);

  /* --------------- drag logic --------------- */
  const snapTime = useCallback(
    (t: number, ignoreClipId?: string): number => {
      const store = useEditor.getState();
      if (!store.snapping) return Math.max(0, t);
      const candidates: number[] = [0, store.playhead];
      for (const c of store.project.clips) {
        if (c.id === ignoreClipId) continue;
        candidates.push(c.start, clipEnd(c));
      }
      const threshold = 8 / zoom; // 8px
      let best = t;
      let bestDist = threshold;
      for (const c of candidates) {
        const d = Math.abs(t - c);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return Math.max(0, best);
    },
    [zoom]
  );

  const beginDrag = (e: React.PointerEvent, clip: Clip, mode: "move" | "trim-l" | "trim-r") => {
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;
    e.stopPropagation();
    e.preventDefault();
    select(clip.id);
    const store = useEditor.getState();
    store.commit(); // single undo entry per drag

    // lane-relative helper: converts a clientX to lane X (accounts for scroll + sticky header)
    const laneX = (clientX: number): number => {
      const rect = lanesRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    };

    const drag: DragState =
      mode === "move"
        ? { mode, clipId: clip.id, origStart: clip.start, origTrackId: clip.trackId, grabOffsetX: laneX(e.clientX) - clip.start * zoom, grabOffsetY: 0 }
        : mode === "trim-l"
          ? { mode, clipId: clip.id, origStart: clip.start, origDuration: clip.duration, origTrimStart: clip.trimStart }
          : { mode, clipId: clip.id, origDuration: clip.duration, origTrimStart: clip.trimStart };
    dragRef.current = drag;

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const store2 = useEditor.getState();
      const clip2 = store2.project.clips.find((c) => c.id === d.clipId);
      if (!clip2) return;
      const asset = store2.project.assets.find((a) => a.id === clip2.assetId);
      const srcDuration = asset?.duration ?? null;

      if (d.mode === "move") {
        let newStart = (laneX(ev.clientX) - d.grabOffsetX) / zoom;
        newStart = snapTime(newStart, clip2.id);
        // vertical track change (same lane family)
        const lanesRect = lanesRef.current?.getBoundingClientRect();
        if (lanesRect) {
          const y = ev.clientY - lanesRect.top - 28; // minus ruler height
          const wanted = clip2.type === "audio" ? "audio" : "video";
          const candidates = store2.project.tracks.filter((t) => t.type === wanted && !t.locked);
          let acc = 0;
          for (const t of candidates) {
            if (y >= acc && y < acc + t.height) {
              if (t.id !== clip2.trackId) {
                store2.updateClip(clip2.id, { trackId: t.id }, { history: false });
              }
              break;
            }
            acc += t.height;
          }
        }
        store2.updateClip(clip2.id, { start: Math.max(0, newStart) }, { history: false });
      } else if (d.mode === "trim-r") {
        let newEnd = snapTime(laneX(ev.clientX) / zoom, clip2.id);
        let newDuration = Math.max(0.1, newEnd - clip2.start);
        if (srcDuration != null && (clip2.type === "video" || clip2.type === "audio")) {
          const maxDur = Math.max(0.1, (srcDuration - clip2.trimStart) / clip2.speed);
          newDuration = Math.min(newDuration, maxDur);
        }
        store2.updateClip(clip2.id, { duration: newDuration }, { history: false });
      } else if (d.mode === "trim-l") {
        let newStart = snapTime(laneX(ev.clientX) / zoom, clip2.id);
        newStart = Math.max(0, Math.min(newStart, d.origStart + d.origDuration - 0.1));
        const delta = newStart - d.origStart;
        let newTrim = d.origTrimStart + delta * clip2.speed;
        if (newTrim < 0) {
          const fixedDelta = -d.origTrimStart / clip2.speed;
          newStart = d.origStart + fixedDelta;
          newTrim = 0;
        }
        store2.updateClip(
          clip2.id,
          { start: newStart, duration: d.origStart + d.origDuration - newStart, trimStart: newTrim },
          { history: false }
        );
      }
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* --------------- drop from sidebar --------------- */
  const onLaneDragOver = (e: React.DragEvent, track: Track) => {
    if (track.locked) return;
    e.preventDefault();
    setDragOverTrack(track.id);
  };

  const onLaneDrop = (e: React.DragEvent, track: Track) => {
    e.preventDefault();
    setDragOverTrack(null);
    const assetId = e.dataTransfer.getData("application/visioncut-asset");
    if (!assetId) return;
    const store = useEditor.getState();
    const asset = store.project.assets.find((a) => a.id === assetId);
    if (!asset) return;
    const lanes = lanesRef.current;
    let at = store.playhead;
    if (lanes) {
      const rect = lanes.getBoundingClientRect();
      at = (e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0)) / zoom;
    }
    at = snapTime(at);
    const trackOk = (asset.kind === "audio") === (track.type === "audio");
    const targetTrack = trackOk ? track : store.project.tracks.find((t) => t.type === (asset.kind === "audio" ? "audio" : "video"));
    if (!targetTrack) return;
    store.addClipFromAsset(asset, targetTrack.id, Math.max(0, at));
  };

  /* --------------- render --------------- */
  const headerWidth = 132;
  const totalWidth = (duration + 6) * zoom;

  return (
    <div className="flex h-full flex-col border-t border-white/8 bg-[#07070c]">
      {/* tools row */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-white/8 bg-[#0a0a12] px-2.5">
        <TimelineBtn label="Split clip at playhead (S)" onClick={() => selection && splitClip(selection, playhead)} disabled={!selection}>
          <Scissors className="h-3.5 w-3.5" />
        </TimelineBtn>
        <TimelineBtn label="Duplicate clip (Ctrl+D)" onClick={() => selection && duplicateClip(selection)} disabled={!selection}>
          <Copy className="h-3.5 w-3.5" />
        </TimelineBtn>
        <TimelineBtn label="Delete clip (Del)" onClick={() => selection && removeClip(selection)} disabled={!selection} danger>
          <Trash2 className="h-3.5 w-3.5" />
        </TimelineBtn>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <TimelineBtn label="Snapping" onClick={() => setSnapping(!snapping)} active={snapping}>
          <Magnet className="h-3.5 w-3.5" />
        </TimelineBtn>
        <TimelineBtn label="Add video track" onClick={() => addTrack("video")}>
          <Video className="h-3.5 w-3.5" />
          <Plus className="-ml-1 h-2.5 w-2.5" />
        </TimelineBtn>
        <TimelineBtn label="Add audio track" onClick={() => addTrack("audio")}>
          <Music className="h-3.5 w-3.5" />
          <Plus className="-ml-1 h-2.5 w-2.5" />
        </TimelineBtn>

        <div className="ml-auto flex items-center gap-2">
          <ZoomIn className="h-3.5 w-3.5 text-zinc-500" />
          <input
            type="range"
            min={8}
            max={400}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="vc-range w-32"
            aria-label="Timeline zoom"
          />
        </div>
      </div>

      {/* tracks area — single scroll container with sticky headers for perfect sync */}
      <div ref={scrollRef} className="scrollbar-slim relative min-h-0 flex-1 overflow-auto">
        <div className="flex" style={{ width: headerWidth + totalWidth }}>
          {/* sticky track headers */}
          <div className="sticky left-0 z-20 w-[132px] shrink-0 border-r border-white/8 bg-[#090910]">
            <div className="h-7 border-b border-white/8 bg-[#08080e]" />
            {project.tracks.map((track) => (
              <div
                key={track.id}
                style={{ height: track.height }}
                className="flex items-center justify-between gap-1 border-b border-white/5 px-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold text-zinc-300">{track.name}</p>
                  <p className="text-[8px] uppercase tracking-wider text-zinc-600">{track.type}</p>
                </div>
                <div className="flex shrink-0 items-center">
                  {track.type === "video" ? (
                    <TrackBtn
                      label={track.hidden ? "Show track" : "Hide track"}
                      onClick={() => updateTrack(track.id, { hidden: !track.hidden })}
                      active={track.hidden}
                    >
                      {track.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </TrackBtn>
                  ) : (
                    <TrackBtn
                      label={track.muted ? "Unmute track" : "Mute track"}
                      onClick={() => updateTrack(track.id, { muted: !track.muted })}
                      active={track.muted}
                    >
                      {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    </TrackBtn>
                  )}
                  <TrackBtn
                    label={track.locked ? "Unlock track" : "Lock track"}
                    onClick={() => updateTrack(track.id, { locked: !track.locked })}
                    active={track.locked}
                  >
                    {track.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                  </TrackBtn>
                  <TrackBtn label="Delete track" onClick={() => removeTrack(track.id)}>
                    <Trash2 className="h-3 w-3" />
                  </TrackBtn>
                </div>
              </div>
            ))}
          </div>

          {/* lanes column */}
          <div
            ref={lanesRef}
            className="relative"
            style={{ width: totalWidth, minWidth: "calc(100% - 132px)" }}
          >
            <Ruler zoom={zoom} duration={duration} scrollRef={scrollRef} />
            {project.tracks.map((track) => (
              <div
                key={track.id}
                style={{ height: track.height }}
                className={cn(
                  "relative border-b border-white/5 transition-colors",
                  track.type === "video" ? "bg-white/[0.015]" : "bg-emerald-500/[0.02]",
                  dragOverTrack === track.id && "bg-violet-500/10 ring-1 ring-inset ring-violet-400/40",
                  track.locked && "opacity-60"
                )}
                onDragOver={(e) => onLaneDragOver(e, track)}
                onDragLeave={() => setDragOverTrack((t) => (t === track.id ? null : t))}
                onDrop={(e) => onLaneDrop(e, track)}
                onClick={(e) => {
                  if (e.target === e.currentTarget) select(null);
                }}
              >
                {project.clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => (
                    <ClipBlock
                      key={clip.id}
                      clip={clip}
                      zoom={zoom}
                      selected={selection === clip.id}
                      onPointerDown={(e, mode) => beginDrag(e, clip, mode)}
                    />
                  ))}
              </div>
            ))}
            <PlayheadLine zoom={zoom} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineBtn({
  children, label, onClick, disabled, active, danger,
}: {
  children: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; active?: boolean; danger?: boolean;
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
              "flex h-7 items-center justify-center gap-0.5 rounded-lg px-2 text-zinc-400 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-35",
              active && "bg-violet-500/20 text-violet-300 hover:bg-violet-500/25",
              danger && "hover:bg-rose-500/15 hover:text-rose-300"
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

function TrackBtn({
  children, label, onClick, active,
}: { children: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            aria-label={label}
            className={cn(
              "flex h-5.5 w-5.5 items-center justify-center rounded p-1 text-zinc-600 transition-colors hover:bg-white/8 hover:text-zinc-200",
              active && "text-violet-300"
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

function ClipBlock({
  clip, zoom, selected, onPointerDown,
}: {
  clip: Clip; zoom: number; selected: boolean;
  onPointerDown: (e: React.PointerEvent, mode: "move" | "trim-l" | "trim-r") => void;
}) {
  const asset = useEditor((s) => s.project.assets.find((a) => a.id === clip.assetId));
  const width = Math.max(6, clip.duration * zoom);
  const left = clip.start * zoom;

  const Icon = clip.type === "video" ? Video : clip.type === "audio" ? Music : clip.type === "image" ? ImageIcon : TypeIcon;

  return (
    <div
      className={cn(
        "group absolute top-[3px] bottom-[3px] overflow-hidden rounded-md border shadow-[0_2px_10px_-2px_rgba(0,0,0,0.6)] transition-shadow",
        TRACK_TYPE_COLORS[clip.type],
        selected && "ring-2 ring-violet-300 shadow-[0_0_18px_-2px_rgba(139,92,246,0.8)] z-10",
        !selected && "hover:brightness-110"
      )}
      style={{ left, width }}
      onPointerDown={(e) => onPointerDown(e, "move")}
      role="button"
      tabIndex={0}
      aria-label={`${clip.type} clip: ${clip.name}, ${clip.duration.toFixed(1)} seconds`}
      onKeyDown={(e) => {
        if (e.key === "Enter") useEditor.getState().select(clip.id);
      }}
    >
      {/* thumbnail strip for video/image */}
      {(clip.type === "video" || clip.type === "image") && asset?.thumbnail && (
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage: `url(${asset.thumbnail})`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
          }}
          aria-hidden
        />
      )}
      {/* waveform for audio */}
      {clip.type === "audio" && <Waveform clip={clip} height={48} />}
      {/* missing media hint */}
      {(clip.type === "video" || clip.type === "audio") && clip.assetId && !asset && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] font-semibold uppercase tracking-wider text-rose-300">
          media missing
        </div>
      )}

      <div className="relative flex h-full items-center gap-1.5 px-2">
        <Icon className="h-3 w-3 shrink-0 text-white/80" />
        <span className="truncate text-[10px] font-semibold text-white/95">{clip.name}</span>
        {clip.speed !== 1 && <span className="shrink-0 rounded bg-black/40 px-1 text-[8px] text-white/80">{clip.speed}×</span>}
        {clip.animation !== "none" && <span className="shrink-0 rounded bg-black/40 px-1 text-[8px] text-white/80">anim</span>}
      </div>

      {/* trim handles */}
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-w-resize bg-white/0 transition-colors group-hover:bg-white/20"
        onPointerDown={(e) => onPointerDown(e, "trim-l")}
        aria-label="Trim clip start"
      />
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-e-resize bg-white/0 transition-colors group-hover:bg-white/20"
        onPointerDown={(e) => onPointerDown(e, "trim-r")}
        aria-label="Trim clip end"
      />
    </div>
  );
}
