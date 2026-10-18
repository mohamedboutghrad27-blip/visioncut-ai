"use client";

/* Background cloud backup of editor media blobs.
 *
 * Local (IndexedDB) remains the source of truth for the current browser —
 * instant, offline-friendly. This module mirrors every ingested blob to the
 * server (Postgres/Neon) in ~3MB chunks so the SAME project can restore its
 * media on any other browser or device. Uploads are silent best-effort:
 * failures never block editing; restore tries the cloud only on local miss.
 */

const CHUNK = 3 * 1024 * 1024; // fits Vercel serverless body limit with headroom

const pending = new Set<string>();
const done = new Set<string>();

/** Already mirrored to the cloud (this session). */
export function isCloudSynced(id: string): boolean {
  return done.has(id);
}

export function queueCloudUpload(
  id: string,
  blob: Blob,
  meta: { name: string; mimeType: string },
): void {
  if (typeof window === "undefined") return;
  if (!blob || blob.size === 0) return;
  if (pending.has(id) || done.has(id)) return;
  pending.add(id);

  void (async () => {
    try {
      const init = await fetch("/api/media/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: meta.name, mimeType: meta.mimeType, size: blob.size }),
      });
      if (!init.ok) return; // 401 logged out / 507 storage full / 4xx — stay silent

      const parts = Math.ceil(blob.size / CHUNK);
      for (let i = 0; i < parts; i++) {
        const slice = blob.slice(i * CHUNK, Math.min(blob.size, (i + 1) * CHUNK));
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            const res = await fetch(
              `/api/media/${encodeURIComponent(id)}/chunk?index=${i}`,
              { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: slice },
            );
            ok = res.ok;
          } catch {
            ok = false;
          }
        }
        if (!ok) return; // abort this upload quietly; local copy still works
      }

      await fetch(`/api/media/${encodeURIComponent(id)}/complete`, { method: "POST" });
      done.add(id);
    } catch {
      /* best-effort — never surface upload noise to the editor */
    } finally {
      pending.delete(id);
    }
  })();
}
