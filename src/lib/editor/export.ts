"use client";

import { type ProjectState, type Asset, ASPECT_DIMS, type AspectRatio } from "./types";
import { getAssetUrl } from "./idb";
import {
  renderFrame, syncMedia, releaseAllMedia, pauseAllMedia, getMediaForClip, ensureMediaUrl as ensureUrlHelper,
} from "./engine";

export type ExportSettings = {
  resolution: "480p" | "720p" | "1080p" | "1440p" | "4K";
  fps: 24 | 25 | 30 | 50 | 60;
  format: "webm" | "mp4";
  quality: "draft" | "standard" | "high" | "maximum";
  audioBitrateKbps: 128 | 192 | 256;
};

export const RESOLUTION_HEIGHTS: Record<ExportSettings["resolution"], number> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
  "1440p": 1440,
  "4K": 2160,
};

export const QUALITY_BITRATE_SCALE: Record<ExportSettings["quality"], number> = {
  draft: 0.55,
  standard: 1,
  high: 1.6,
  maximum: 2.4,
};

function dimsFor(ar: AspectRatio, height: number): { w: number; h: number } {
  const base = ASPECT_DIMS[ar] || ASPECT_DIMS["16:9"];
  const scale = height / base.h;
  return { w: Math.round(base.w * scale / 2) * 2, h: Math.round(base.h * scale / 2) * 2 };
}

function bitrateFor(settings: ExportSettings, ar: AspectRatio): number {
  const base = RESOLUTION_HEIGHTS[settings.resolution] >= 2160 ? 30e6
    : RESOLUTION_HEIGHTS[settings.resolution] >= 1440 ? 16e6
    : RESOLUTION_HEIGHTS[settings.resolution] >= 1080 ? 10e6
    : RESOLUTION_HEIGHTS[settings.resolution] >= 720 ? 5e6
    : 2.5e6;
  const base2 = (ASPECT_DIMS[ar].w / ASPECT_DIMS[ar].h) > 1.9 ? base * 1.25 : base;
  return Math.round(base2 * QUALITY_BITRATE_SCALE[settings.quality]);
}

export function estimateSizeBytes(durationSec: number, settings: ExportSettings, ar: AspectRatio): number {
  return Math.round(((bitrateFor(settings, ar) + settings.audioBitrateKbps * 1000) / 8) * durationSec);
}

export function pickMimeType(format: "webm" | "mp4"): { mimeType: string; ext: string } {
  const candidates =
    format === "mp4"
      ? ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"]
      : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const mimeType of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType)) {
      return { mimeType, ext: mimeType.startsWith("video/mp4") ? "mp4" : "webm" };
    }
  }
  return { mimeType: "", ext: format === "mp4" ? "mp4" : "webm" };
}

export type ExportHandle = {
  promise: Promise<{ blob: Blob; ext: string; mimeType: string }>;
  cancel: () => void;
};

/**
 * Real browser-side export: renders every frame through the same canvas
 * compositor used by the preview, captures canvas + mixed audio with
 * MediaRecorder, and resolves only with a fully-written file.
 * Rendering happens at 1× real time (a hardware-encoder constraint of
 * MediaRecorder capture).
 */
export function startExport(
  project: ProjectState,
  settings: ExportSettings,
  onProgress: (p: number, stage: string) => void,
  onDone: () => void
): ExportHandle {
  let cancelled = false;
  let cleanup = () => {};

  const promise = new Promise<{ blob: Blob; ext: string; mimeType: string }>((resolve, reject) => {
    (async () => {
      try {
        const duration = project.duration || project.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
        if (duration <= 0) throw new Error("Nothing to export — add at least one clip to the timeline.");

        const hasMedia = project.clips.some((c) => c.type === "video" || c.type === "audio");
        if (typeof MediaRecorder === "undefined") {
          throw new Error("This browser does not support MediaRecorder, which the export pipeline requires.");
        }
        if (hasMedia && typeof HTMLVideoElement === "undefined") {
          throw new Error("Media export is unavailable in this environment.");
        }

        const { w, h } = dimsFor(project.aspectRatio, RESOLUTION_HEIGHTS[settings.resolution]);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Could not create the export canvas.");

        onProgress(0, "Preparing media…");

        // Resolve asset URLs (from IndexedDB) into the media registry
        const assets: Asset[] = project.assets;
        for (const clip of project.clips) {
          if ((clip.type === "video" || clip.type === "audio") && clip.assetId) {
            const url = await getAssetUrl(clip.assetId);
            if (url) {
              ensureUrlHelper(clip, url);
              getMediaForClip(clip, project.assets);
            }
          }
        }

        // Wait for all media to be ready (bounded)
        await Promise.race([
          new Promise<void>((res) => {
            const started = Date.now();
            const check = () => {
              const pending = project.clips
                .filter((c) => c.type === "video")
                .map((c) => getMediaForClip(c, project.assets))
                .filter((e): e is NonNullable<typeof e> => !!e)
                .filter((e) => !e.ready && !e.failed);
              if (pending.length === 0 || Date.now() - started > 15000) res();
              else setTimeout(check, 150);
            };
            check();
          }),
          new Promise<void>((res) => setTimeout(res, 16000)),
        ]);
        if (cancelled) throw new DOMException("Export cancelled", "AbortError");

        // Audio graph: connect every audio-capable element to a mixed destination
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        let anyAudio = false;
        for (const clip of project.clips) {
          if (clip.type !== "video" && clip.type !== "audio") continue;
          const entry = getMediaForClip(clip, project.assets);
          if (!entry || entry.failed) continue;
          try {
            const src = audioCtx.createMediaElementSource(entry.el as HTMLMediaElement);
            const gain = audioCtx.createGain();
            gain.gain.value = Math.min(1, Math.max(0, clip.volume)) * (clip.muted ? 0 : 1);
            src.connect(gain).connect(dest);
            anyAudio = true;
          } catch {
            /* element may already be connected */
          }
        }
        if (audioCtx.state === "suspended") await audioCtx.resume();

        const stream = canvas.captureStream(settings.fps);
        if (anyAudio) dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

        const { mimeType, ext } = pickMimeType(settings.format);
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: bitrateFor(settings, project.aspectRatio),
          audioBitsPerSecond: settings.audioBitrateKbps * 1000,
        };
        if (mimeType) options.mimeType = mimeType;

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, options);
        } catch {
          try {
            recorder = new MediaRecorder(stream);
          } catch (err) {
            throw new Error("Could not start the encoder in this browser.");
          }
        }

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        const finished = new Promise<Blob>((resolve2, reject2) => {
          recorder.onstop = () => {
            if (cancelled) return reject2(new DOMException("Export cancelled", "AbortError"));
            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
            if (blob.size < 1024) return reject2(new Error("The encoder produced an empty file. Try a lower resolution."));
            resolve2(blob);
          };
          recorder.onerror = () => reject2(new Error("The encoder encountered an error mid-export."));
        });

        recorder.start(1000);

        // Seek all media to 0
        syncMedia(project, 0, assets, { playing: false });

        // Real-time render loop driven by wall-clock time
        const startWall = performance.now();
        let stopped = false;
        cleanup = () => {
          if (stopped) return;
          stopped = true;
          cancelled = true;
          try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* noop */ }
          try { audioCtx.close(); } catch { /* noop */ }
          releaseAllMedia();
          pauseAll();
        };

        const totalMs = duration * 1000;
        const step = () => {
          if (stopped || cancelled) return;
          const elapsed = performance.now() - startWall;
          const t = Math.min(duration, elapsed / 1000);
          syncMedia(project, t, assets, { playing: true });
          renderFrame(ctx, project, t, assets, { width: w, height: h });
          onProgress(Math.min(0.99, elapsed / totalMs), `Rendering ${Math.round(t)}s / ${Math.round(duration)}s`);
          if (elapsed >= totalMs) {
            // hold a final beat so the last frame is captured, then stop
            setTimeout(() => {
              if (stopped || cancelled) return;
              try { recorder.stop(); } catch { /* noop */ }
              try { audioCtx.close(); } catch { /* noop */ }
              stream.getTracks().forEach((tr) => tr.stop());
            }, 350);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);

        const blob = await finished;
        if (cancelled) throw new DOMException("Export cancelled", "AbortError");
        cleanup = () => {};
        releaseAllMedia();
        onProgress(1, "Finalizing…");
        onDone();
        resolve({ blob, ext, mimeType: blob.type });
      } catch (err) {
        cleanup();
        releaseAllMedia();
        reject(err);
      }
    })();
  });

  return { promise, cancel: () => cleanup() };
}

function pauseAll() {
  pauseAllMedia();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFilename(name: string, ext: string): string {
  const clean = name.replace(/[^\w\d\- ]+/g, "").trim().replace(/\s+/g, "-") || "visioncut-export";
  return `${clean}.${ext}`;
}
