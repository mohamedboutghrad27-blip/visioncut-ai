/* VisionCut editor core types */

export type ClipType = "video" | "audio" | "image" | "text";
export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "21:9";

export type ColorAdjustments = {
  brightness: number; // 0..2 (1 = neutral)
  contrast: number; // 0..2
  saturation: number; // 0..2
  hue: number; // -180..180
  blur: number; // 0..20 px
};

export const NEUTRAL_COLOR: ColorAdjustments = {
  brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0,
};

export type TextConfig = {
  content: string;
  fontSize: number; // fraction of canvas height
  color: string;
  weight: number;
  align: "left" | "center" | "right";
  family: "display" | "sans" | "mono";
  bgOpacity: number; // 0..1 caption box
  letterSpacing: number;
};

export type ClipAnimation =
  | "none" | "fadeIn" | "fadeOut" | "fadeBoth"
  | "kenBurns" | "slideLeft" | "slideUp" | "popIn";

export type Clip = {
  id: string;
  trackId: string;
  type: ClipType;
  name: string;
  assetId?: string;
  start: number; // timeline seconds
  duration: number; // timeline seconds
  trimStart: number; // source in-point seconds
  x: number; // -1..1 relative offset
  y: number;
  scale: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  volume: number; // 0..2
  speed: number; // 0.25..4
  muted?: boolean;
  color: ColorAdjustments;
  text?: TextConfig;
  animation: ClipAnimation;
  animationDuration: number; // seconds
  peaks?: number[]; // audio waveform, normalized
};

export type Track = {
  id: string;
  type: "video" | "audio";
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  height: number;
};

export type Asset = {
  id: string;
  kind: "video" | "audio" | "image";
  name: string;
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string; // data URL
  origin: "upload" | "ai" | "sample";
  createdAt: number;
};

export type ProjectState = {
  version: 1;
  name: string;
  aspectRatio: AspectRatio;
  tracks: Track[];
  clips: Clip[];
  assets: Asset[];
  duration: number;
};

export const ASPECT_DIMS: Record<AspectRatio, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "21:9": { w: 1920, h: 822 },
};

export const ASPECT_LIST: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "Widescreen 16:9" },
  { value: "9:16", label: "Vertical 9:16" },
  { value: "1:1", label: "Square 1:1" },
  { value: "4:5", label: "Portrait 4:5" },
  { value: "21:9", label: "Cinemascope 21:9" },
];

export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
export const ACCEPTED_VIDEO = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg"];
export const ACCEPTED_AUDIO = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/ogg", "audio/aac", "audio/flac"];
export const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export function computeDuration(clips: Clip[]): number {
  return clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

export function clipEnd(c: Clip): number {
  return c.start + c.duration;
}

export function isActiveAt(c: Clip, t: number): boolean {
  return t >= c.start - 1e-6 && t < clipEnd(c) - 1e-6;
}

export function formatTimecode(seconds: number, fps = 30): string {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const ff = Math.floor((s - Math.floor(s)) * fps);
  return `00:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function uid(prefix = "c"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function newClip(partial: Partial<Clip> & { trackId: string; type: ClipType }): Clip {
  return {
    id: uid(),
    name: "Clip",
    start: 0,
    duration: 4,
    trimStart: 0,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { ...NEUTRAL_COLOR },
    animation: "none",
    animationDuration: 0.6,
    ...partial,
  };
}
