"use client";

import {
  type Asset, type Clip, type ProjectState, ASPECT_DIMS, isActiveAt, clipEnd,
} from "./types";

/* ------------------------------------------------------------------ */
/* Media registry: one HTMLVideo/HTMLAudio element per clip             */
/* ------------------------------------------------------------------ */

type MediaEntry = {
  el: HTMLVideoElement | HTMLAudioElement;
  kind: "video" | "audio";
  ready: boolean;
  failed: boolean;
};

const registry = new Map<string, MediaEntry>();

function createEntry(kind: "video" | "audio", url: string): MediaEntry {
  let el: HTMLVideoElement | HTMLAudioElement;
  if (kind === "video") {
    const v = document.createElement("video");
    v.src = url;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.muted = false;
    v.playsInline = true;
    el = v;
  } else {
    const a = document.createElement("audio");
    a.src = url;
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    el = a;
  }
  const entry: MediaEntry = { el, kind, ready: false, failed: false };
  el.addEventListener("loadeddata", () => { entry.ready = true; });
  el.addEventListener("error", () => { entry.failed = true; });
  return entry;
}

export function getMediaForClip(clip: Clip, assets: Asset[]): MediaEntry | null {
  if ((clip.type !== "video" && clip.type !== "audio") || !clip.assetId) return null;
  const existing = registry.get(clip.id);
  if (existing) return existing;
  const asset = assets.find((a) => a.id === clip.assetId);
  if (!asset) return null;
  const kind = clip.type === "video" ? "video" : "audio";
  // URL is resolved by the caller and cached on the clip id via ensureMediaUrl
  const url = (clip as unknown as { _url?: string })._url;
  if (!url) return null;
  const entry = createEntry(kind, url);
  registry.set(clip.id, entry);
  return entry;
}

/** Attach the resolved object URL to the clip for the registry (cheap memo). */
export function ensureMediaUrl(clip: Clip, url: string): void {
  (clip as unknown as { _url?: string })._url = url;
}

/** Async URL hydration for clips created after load (fire-and-forget safe). */
export async function hydrateClipUrl(clip: Clip): Promise<void> {
  if ((clip.type === "video" || clip.type === "audio") && clip.assetId && !(clip as unknown as { _url?: string })._url) {
    const { getAssetUrl } = await import("./idb");
    const url = await getAssetUrl(clip.assetId);
    if (url) ensureMediaUrl(clip, url);
  }
}

export function releaseClipMedia(clipId: string) {
  const entry = registry.get(clipId);
  if (entry) {
    entry.el.pause();
    entry.el.removeAttribute("src");
    entry.el.load();
    registry.delete(clipId);
  }
}

export function releaseAllMedia() {
  for (const id of Array.from(registry.keys())) releaseClipMedia(id);
}

export function pauseAllMedia() {
  for (const entry of registry.values()) entry.el.pause();
}

/* ------------------------------------------------------------------ */
/* Canvas compositor                                                    */
/* ------------------------------------------------------------------ */

const FAMILY_MAP: Record<string, string> = {
  display: "'Space Grotesk', 'Geist', system-ui, sans-serif",
  sans: "'Geist', system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
};

export type RenderOptions = {
  showGuides?: boolean;
  /** optional override canvas dims (export path) */
  width?: number;
  height?: number;
};

function filterString(clip: Clip): string {
  const c = clip.color;
  const parts: string[] = [];
  if (c.brightness !== 1) parts.push(`brightness(${c.brightness})`);
  if (c.contrast !== 1) parts.push(`contrast(${c.contrast})`);
  if (c.saturation !== 1) parts.push(`saturate(${c.saturation})`);
  if (c.hue !== 0) parts.push(`hue-rotate(${c.hue}deg)`);
  if (c.blur > 0) parts.push(`blur(${c.blur}px)`);
  return parts.length ? parts.join(" ") : "none";
}

function animationState(clip: Clip, localTime: number): {
  alpha: number; extraScale: number; offsetX: number; offsetY: number;
} {
  const dur = Math.min(clip.animationDuration, clip.duration / 2);
  const p = dur > 0 ? Math.min(1, localTime / dur) : 1;
  const pEnd = dur > 0 ? Math.min(1, (clip.duration - localTime) / dur) : 1;
  let alpha = 1;
  let extraScale = 1;
  let offsetX = 0;
  let offsetY = 0;
  switch (clip.animation) {
    case "fadeIn":
      alpha = p;
      break;
    case "fadeOut":
      alpha = pEnd;
      break;
    case "fadeBoth":
      alpha = Math.min(p, pEnd);
      break;
    case "popIn":
      alpha = Math.min(1, p * 2);
      extraScale = 0.85 + 0.15 * easeOutBack(p);
      break;
    case "slideLeft":
      alpha = Math.min(1, p * 2);
      offsetX = (1 - easeOutCubic(p)) * 0.25;
      break;
    case "slideUp":
      alpha = Math.min(1, p * 2);
      offsetY = (1 - easeOutCubic(p)) * 0.25;
      break;
    case "kenBurns": {
      const t = clip.duration > 0 ? localTime / clip.duration : 0;
      extraScale = 1 + 0.14 * t;
      break;
    }
    default:
      break;
  }
  return { alpha, extraScale, offsetX, offsetY };
}

function easeOutCubic(x: number) { return 1 - Math.pow(1 - x, 3); }
function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Cover-fit draw of a media element into canvas, with clip transform stack applied. */
function drawVisual(
  ctx: CanvasRenderingContext2D,
  el: HTMLVideoElement | HTMLImageElement,
  clip: Clip,
  W: number,
  H: number,
  localTime: number
) {
  const natW = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const natH = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (!natW || !natH) return;

  const anim = animationState(clip, localTime);
  const alpha = clip.opacity * anim.alpha;
  if (alpha <= 0.001) return;

  // cover fit
  const cover = Math.max(W / natW, H / natH);
  const scale = cover * clip.scale * anim.extraScale;
  const dw = natW * scale;
  const dh = natH * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = filterString(clip);
  ctx.translate(W / 2 + (clip.x + anim.offsetX) * W, H / 2 + (clip.y + anim.offsetY) * H);
  if (clip.rotation) ctx.rotate((clip.rotation * Math.PI) / 180);
  try {
    ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh);
  } catch {
    /* frame not ready */
  }
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  W: number,
  H: number,
  localTime: number
) {
  const t = clip.text;
  if (!t || !t.content) return;
  const anim = animationState(clip, localTime);
  const alpha = clip.opacity * anim.alpha;
  if (alpha <= 0.001) return;

  const fontSize = Math.max(10, t.fontSize * H);
  const family = FAMILY_MAP[t.family] || FAMILY_MAP.sans;
  const lines = t.content.split("\n");
  const lineHeight = fontSize * 1.25;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2 + (clip.x + anim.offsetX) * W, H / 2 + (clip.y + anim.offsetY) * H);
  if (clip.rotation) ctx.rotate((clip.rotation * Math.PI) / 180);
  ctx.scale(clip.scale * anim.extraScale, clip.scale * anim.extraScale);

  ctx.font = `${t.weight} ${fontSize}px ${family}`;
  ctx.textAlign = t.align;
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${t.letterSpacing}em`;

  const totalH = lines.length * lineHeight;

  if (t.bgOpacity > 0) {
    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const padX = fontSize * 0.5;
    const padY = fontSize * 0.3;
    let bx: number;
    if (t.align === "left") bx = -maxW / 2 - padX;
    else if (t.align === "right") bx = -maxW / 2 - padX;
    else bx = -maxW / 2 - padX;
    ctx.save();
    ctx.globalAlpha = alpha * t.bgOpacity;
    ctx.fillStyle = "#000000";
    const r = fontSize * 0.18;
    const bw = maxW + padX * 2;
    const bh = totalH + padY * 2;
    ctx.beginPath();
    ctx.roundRect(bx, -totalH / 2 - padY, bw, bh, r);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = t.color;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = fontSize * 0.14;
  ctx.shadowOffsetY = fontSize * 0.03;
  lines.forEach((line, i) => {
    const y = -totalH / 2 + lineHeight * (i + 0.5);
    ctx.fillText(line, t.align === "left" ? -W * 0.35 : t.align === "right" ? W * 0.35 : 0, y);
  });
  ctx.restore();
}

/** Render one frame of the project at `time` into ctx (canvas sized W×H). */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: ProjectState,
  time: number,
  assets: Asset[],
  opts: RenderOptions = {}
) {
  const dims = ASPECT_DIMS[project.aspectRatio] || ASPECT_DIMS["16:9"];
  const W = opts.width || dims.w;
  const H = opts.height || dims.h;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Render bottom tracks first so tracks[0] (top of the timeline UI) draws last/on top
  const tracks = [...project.tracks].reverse();
  for (const track of tracks) {
    if (track.type === "video" && track.hidden) continue;
    const clips = project.clips.filter((c) => c.trackId === track.id && isActiveAt(c, time));
    for (const clip of clips) {
      const localTime = time - clip.start;
      if (clip.type === "video" || clip.type === "image") {
        const entry = clip.type === "video" ? getMediaForClip(clip, project.assets) : null;
        let el: HTMLVideoElement | HTMLImageElement | null = null;
        if (clip.type === "video") {
          el = entry && entry.ready ? (entry.el as HTMLVideoElement) : null;
          if (!el) {
            // fallback: draw the asset thumbnail so the preview is never empty
            const asset = assets.find((a) => a.id === clip.assetId);
            if (asset?.thumbnail) {
              const img = thumbImage(asset.thumbnail);
              if (img?.complete) drawVisual(ctx, img, clip, W, H, localTime);
            }
            continue;
          }
        } else {
          const asset = assets.find((a) => a.id === clip.assetId);
          if (!asset?.thumbnail) continue;
          const img = thumbImage(asset.thumbnail);
          if (img?.complete) drawVisual(ctx, img, clip, W, H, localTime);
          continue;
        }
        drawVisual(ctx, el, clip, W, H, localTime);
      } else if (clip.type === "text") {
        drawText(ctx, clip, W, H, localTime);
      }
      // audio clips produce no visuals
    }
  }

  if (opts.showGuides) {
    drawGuides(ctx, W, H, project.aspectRatio);
  }
}

/* Thumbnail image cache for fallbacks & image clips */
const thumbCache = new Map<string, HTMLImageElement>();
function thumbImage(dataUrl: string): HTMLImageElement | null {
  let img = thumbCache.get(dataUrl);
  if (!img) {
    img = new Image();
    img.src = dataUrl;
    thumbCache.set(dataUrl, img);
  }
  return img.complete || img.naturalWidth ? img : null;
}

function drawGuides(ctx: CanvasRenderingContext2D, W: number, H: number, ar: string) {
  ctx.save();
  ctx.strokeStyle = "rgba(139,92,246,0.5)";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = Math.max(1, W / 800);
  // thirds
  [1 / 3, 2 / 3].forEach((f) => {
    ctx.beginPath();
    ctx.moveTo(W * f, 0); ctx.lineTo(W * f, H); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke();
  });
  ctx.strokeStyle = "rgba(34,211,238,0.4)";
  // center cross
  ctx.beginPath();
  ctx.moveTo(W / 2 - 20, H / 2); ctx.lineTo(W / 2 + 20, H / 2);
  ctx.moveTo(W / 2, H / 2 - 20); ctx.lineTo(W / 2, H / 2 + 20);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `${Math.max(10, W / 90)}px sans-serif`;
  ctx.fillText(`Guides · ${ar}`, 12, H - 12);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Media synchronization (playback & scrubbing)                         */
/* ------------------------------------------------------------------ */

export type SyncOptions = { playing: boolean };

export function syncMedia(project: ProjectState, time: number, assets: Asset[], opts: SyncOptions) {
  for (const clip of project.clips) {
    if (clip.type !== "video" && clip.type !== "audio") continue;
    const entry = getMediaForClip(clip, project.assets);
    if (!entry || entry.failed) continue;
    const el = entry.el;
    const track = project.tracks.find((t) => t.id === clip.trackId);
    const active = isActiveAt(clip, time);
    const trackMuted = track ? track.muted : false;

    if (!active) {
      if (!el.paused) el.pause();
      continue;
    }

    const target = clip.trimStart + (time - clip.start) * clip.speed;
    const rate = Math.min(4, Math.max(0.25, clip.speed));
    if (Math.abs(el.playbackRate - rate) > 0.01) el.playbackRate = rate;

    const vol = clip.muted || trackMuted ? 0 : Math.min(1, Math.max(0, clip.volume));
    if (Math.abs(el.volume - vol) > 0.02) el.volume = vol;

    const drift = Math.abs(el.currentTime - target);
    const driftTolerance = opts.playing ? 0.32 : 0.045;
    if (drift > driftTolerance && el.readyState >= 1 && isFinite(target)) {
      try { el.currentTime = Math.max(0, target); } catch { /* seek not ready */ }
    }

    if (opts.playing && el.paused) {
      el.play().catch(() => { /* autoplay guard */ });
    } else if (!opts.playing && !el.paused) {
      el.pause();
    }
  }
}

export function mediaDurationOf(clip: Clip, assets: Asset[]): number | null {
  const asset = assets.find((a) => a.id === clip.assetId);
  return asset?.duration ?? null;
}

/** Trim bounds: how far the in/out points can move given source length & speed. */
export function trimLimits(clip: Clip, assets: Asset[]): { maxLeft: number; maxRight: number } {
  const src = mediaDurationOf(clip, assets);
  if (src == null) return { maxLeft: Infinity, maxRight: Infinity };
  return {
    maxLeft: clip.trimStart, // can't trim left beyond current in-point
    maxRight: Math.max(0, (src - clip.trimStart) / clip.speed - clip.duration), // extra seconds available
  };
}

export function clipSourceTime(clip: Clip, time: number): number {
  return clip.trimStart + (time - clip.start) * clip.speed;
}

export { clipEnd };
