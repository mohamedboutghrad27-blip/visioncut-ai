"use client";

import { type Asset, MAX_FILE_SIZE, ACCEPTED_VIDEO, ACCEPTED_AUDIO, ACCEPTED_IMAGE } from "./types";
import { storeBlob } from "./idb";
import { queueCloudUpload } from "./cloud";
import { uid } from "./types";

export type IngestResult = { asset: Asset };

export class IngestError extends Error {}

export function validateFile(file: File): { kind: Asset["kind"] } | { error: string } {
  const type = (file.type || "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const videoOk = ACCEPTED_VIDEO.includes(type) || ["mp4", "webm", "mov", "m4v", "ogv"].includes(ext);
  const audioOk = ACCEPTED_AUDIO.includes(type) || ["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus"].includes(ext);
  const imageOk = ACCEPTED_IMAGE.includes(type) || ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext);
  if (!videoOk && !audioOk && !imageOk) {
    return { error: `“${file.name}” is not a supported media file. Use MP4/WebM video, MP3/WAV audio, or JPEG/PNG/WebP images.` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: `“${file.name}” is ${(file.size / 1048576).toFixed(0)}MB — the limit is ${MAX_FILE_SIZE / 1048576}MB per file.` };
  }
  if (file.size === 0) return { error: `“${file.name}” appears to be empty.` };
  return { kind: videoOk ? "video" : audioOk ? "audio" : "image" };
}

function probeVideo(url: string): Promise<{ duration: number; width: number; height: number; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.src = url;
    const timeout = setTimeout(() => reject(new Error("Video probing timed out")), 20000);
    v.addEventListener("loadeddata", () => {
      // seek to 10% for a representative frame
      v.currentTime = Math.min(v.duration * 0.1 || 0, 2);
    });
    v.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 320 / (v.videoWidth || 320));
        canvas.width = Math.max(2, Math.round((v.videoWidth || 320) * scale));
        canvas.height = Math.max(2, Math.round((v.videoHeight || 180) * scale));
        canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
        clearTimeout(timeout);
        resolve({
          duration: isFinite(v.duration) ? v.duration : 5,
          width: v.videoWidth,
          height: v.videoHeight,
          thumbnail: canvas.toDataURL("image/jpeg", 0.6),
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
    v.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Your browser cannot decode this video format."));
    });
  });
}

function probeImage(url: string): Promise<{ width: number; height: number; thumbnail: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 320 / (img.naturalWidth || 320));
      canvas.width = Math.max(2, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(2, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ width: img.naturalWidth, height: img.naturalHeight, thumbnail: canvas.toDataURL("image/jpeg", 0.7) });
    };
    img.onerror = () => reject(new Error("Your browser cannot decode this image format."));
    img.src = url;
  });
}

function probeAudio(url: string): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = url;
    const timeout = setTimeout(() => reject(new Error("Audio probing timed out")), 15000);
    a.addEventListener("loadedmetadata", () => {
      clearTimeout(timeout);
      resolve({ duration: isFinite(a.duration) ? a.duration : 0 });
    });
    a.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Your browser cannot decode this audio format."));
    });
  });
}

/** Validate, probe and persist a media file. Throws IngestError with a user-friendly message. */
export async function ingestFile(file: File): Promise<IngestResult> {
  const check = validateFile(file);
  if ("error" in check) throw new IngestError(check.error);
  const kind = check.kind;
  const objectUrl = URL.createObjectURL(file);
  try {
    let duration: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let thumbnail: string | undefined;

    if (kind === "video") {
      const probe = await probeVideo(objectUrl);
      duration = probe.duration;
      width = probe.width;
      height = probe.height;
      thumbnail = probe.thumbnail;
    } else if (kind === "image") {
      const probe = await probeImage(objectUrl);
      width = probe.width;
      height = probe.height;
      thumbnail = probe.thumbnail;
    } else {
      const probe = await probeAudio(objectUrl);
      duration = probe.duration;
    }

    const id = await storeBlob(file);
    const asset: Asset = {
      id,
      kind,
      name: file.name.length > 40 ? file.name.slice(0, 37) + "…" : file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      duration,
      width,
      height,
      thumbnail,
      origin: "upload",
      createdAt: Date.now(),
    };
    // Mirror to the cloud so other browsers/devices can restore this asset.
    queueCloudUpload(id, file, { name: asset.name, mimeType: asset.mimeType });
    return { asset };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Ingest a blob generated by AI tools (already have metadata). */
export async function ingestBlob(
  blob: Blob,
  meta: { name: string; kind: Asset["kind"]; mimeType: string; duration?: number; thumbnail?: string; origin?: Asset["origin"] }
): Promise<IngestResult> {
  const id = await storeBlob(blob);
  const asset: Asset = {
    id,
    kind: meta.kind,
    name: meta.name,
    mimeType: meta.mimeType,
    size: blob.size,
    duration: meta.duration,
    thumbnail: meta.thumbnail,
    origin: meta.origin || "ai",
    createdAt: Date.now(),
  };
  // Mirror to the cloud (AI-generated media too — e.g. scene visuals, voiceovers).
  queueCloudUpload(id, blob, { name: asset.name, mimeType: asset.mimeType });
  return { asset };
}

export function assetIcon(kind: Asset["kind"]): string {
  return kind === "video" ? "🎬" : kind === "audio" ? "🎧" : "🖼️";
}

export function newAssetId() {
  return uid("as");
}
